import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

// Track actual connection state
let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let connectionVerified = false;

if (connectionString) {
  try {
    client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 5, // Shorter timeout for faster failure
    });
    dbInstance = drizzle(client, { schema });
    
    // Test connection immediately (async IIFE)
    (async () => {
      try {
        await client!`SELECT 1`;
        connectionVerified = true;
        console.log('Database connection verified');
      } catch (error) {
        connectionVerified = false;
        console.error('Database connection failed:', error instanceof Error ? error.message : 'Unknown error');
        console.log('Running in API-only mode (no database)');
      }
    })();
  } catch (error) {
    console.error('Failed to create database client:', error);
  }
} else {
  console.log('DATABASE_URL not set - running without database');
}

// Export db (may be null if not configured)
export const db = dbInstance!;
export const isDbConnected = () => connectionVerified;

// For routes that need to check before querying
export const checkDbConnection = async (): Promise<boolean> => {
  if (!client) return false;
  if (connectionVerified) return true;
  
  try {
    await client`SELECT 1`;
    connectionVerified = true;
    return true;
  } catch {
    connectionVerified = false;
    return false;
  }
};

export { schema };
