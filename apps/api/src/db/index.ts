import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

// Only create connection if DATABASE_URL is set
let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (connectionString) {
  try {
    client = postgres(connectionString, {
      max: 10, // Connection pool size
      idle_timeout: 20,
      connect_timeout: 10,
    });
    dbInstance = drizzle(client, { schema });
    console.log('Database connection established');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
} else {
  console.log('DATABASE_URL not set - running without database');
}

// Export db (may be null if not configured)
export const db = dbInstance!;
export const isDbConnected = () => !!dbInstance;

export { schema };
