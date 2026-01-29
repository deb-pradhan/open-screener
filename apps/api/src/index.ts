// Load environment variables FIRST before any other imports
import './env';

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { tickersRouter } from './routes/tickers';
import { screenerRouter } from './routes/screener';
import { indicatorsRouter } from './routes/indicators';
import { syncRouter } from './routes/sync';
import { tickerDetailRouter } from './routes/ticker-detail';
import { createWSHandler, type WSData } from './routes/websocket';
import { scheduler } from './services/scheduler';
import { startupService } from './services/startup';

const app = new Hono();
const isProduction = process.env.NODE_ENV === 'production';
const hasDatabase = !!process.env.DATABASE_URL;

// Middleware
app.use('*', logger());

// CORS - more permissive in production for the same origin
app.use('*', cors({
  origin: isProduction 
    ? '*'  // Same origin in production, allow all for flexibility
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Health check (basic)
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    database: hasDatabase ? 'connected' : 'not configured',
  });
});

// Detailed health check (for monitoring)
app.get('/api/health', async (c) => {
  try {
    const { dataSyncService } = await import('./services/data-sync');
    const { MassiveClient } = await import('./clients/massive');
    
    const lastSyncTime = hasDatabase ? await dataSyncService.getLastSyncTime() : null;
    const snapshotCount = hasDatabase ? await dataSyncService.getSnapshotCount() : 0;
    const massiveClient = new MassiveClient();
    
    const isHealthy = !hasDatabase || (lastSyncTime && 
      (Date.now() - lastSyncTime.getTime()) < 2 * 60 * 60 * 1000); // 2h threshold
    
    return c.json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'development',
      database: hasDatabase ? 'connected' : 'not configured',
      lastSync: lastSyncTime?.toISOString() || null,
      snapshotCount,
      circuitBreaker: massiveClient.getCircuitState(),
    }, isHealthy ? 200 : 503);
  } catch (error) {
    return c.json({
      status: 'error',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// API routes
app.route('/api/tickers', tickersRouter);
app.route('/api/screener', screenerRouter);
app.route('/api/indicators', indicatorsRouter);
app.route('/api/sync', syncRouter);
app.route('/api/ticker', tickerDetailRouter);

// Serve static files in production
if (isProduction) {
  const publicDir = './public';
  
  // Log public directory contents on startup for debugging
  try {
    const { readdirSync } = await import('fs');
    const files = readdirSync(publicDir);
    console.log(`📁 Static files in ${publicDir}:`, files.slice(0, 10).join(', '), files.length > 10 ? `... and ${files.length - 10} more` : '');
  } catch (e) {
    console.warn(`⚠️ Could not read public directory: ${e}`);
  }
  
  // Helper to serve static file with proper MIME type
  const serveFile = async (filePath: string) => {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }
    return null;
  };
  
  // Serve static assets (JS, CSS chunks)
  app.use('/assets/*', serveStatic({ root: publicDir }));
  
  // Explicitly serve known static files
  app.get('/logo.png', async (c) => {
    const res = await serveFile(`${publicDir}/logo.png`);
    return res || c.notFound();
  });
  app.get('/favopenscrnr.png', async (c) => {
    const res = await serveFile(`${publicDir}/favopenscrnr.png`);
    return res || c.notFound();
  });
  app.get('/image.png', async (c) => {
    const res = await serveFile(`${publicDir}/image.png`);
    return res || c.notFound();
  });
  app.get('/vite.svg', async (c) => {
    const res = await serveFile(`${publicDir}/vite.svg`);
    return res || c.notFound();
  });
  
  // Fallback for other static files (.png, .ico, .svg, etc.)
  app.get('/:filename{.+\\.(png|ico|svg|jpg|jpeg|webp|gif)$}', async (c) => {
    const filename = c.req.param('filename');
    const res = await serveFile(`${publicDir}/${filename}`);
    return res || c.notFound();
  });
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', async (c) => {
    const file = Bun.file(`${publicDir}/index.html`);
    if (await file.exists()) {
      return new Response(file, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    return c.notFound();
  });
}

// Export for Bun server
const port = Number(process.env.PORT) || 3001;

console.log(`🚀 Server starting on port ${port} (${isProduction ? 'production' : 'development'})`);

// Create the Bun server with WebSocket support
const server = Bun.serve<WSData>({
  port,
  fetch(req, server) {
    const url = new URL(req.url);
    
    // Handle WebSocket upgrade
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, {
        data: { subscribedFilters: new Set<string>() },
      });
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    
    // Handle regular HTTP requests with Hono
    return app.fetch(req);
  },
  websocket: createWSHandler(),
});

console.log(`Server running at http://localhost:${server.port}`);

// Run startup initialization (auto-creates tables, syncs initial data)
if (hasDatabase) {
  startupService.initialize().then(() => {
    // Start scheduler after initialization
    if (isProduction) {
      scheduler.start();
      console.log('Data sync scheduler started');
    } else {
      console.log('Scheduler disabled in development (trigger syncs manually via /api/sync)');
    }
  }).catch(error => {
    console.error('Startup failed, continuing in degraded mode:', error);
  });
} else {
  console.log('No database configured - using API-only mode');
}
