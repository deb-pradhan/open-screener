import { db, schema } from '../db';
import { MassiveClient } from '../clients/massive';
import { eq } from 'drizzle-orm';
import type { NewTicker } from '../db/schema';

const massiveClient = new MassiveClient();

// Sync all tickers from Massive API to database
export async function syncTickers(): Promise<{ synced: number; errors: number }> {
  console.log('Starting ticker sync...');
  
  let synced = 0;
  let errors = 0;

  try {
    const tickers = await massiveClient.getAllTickers();
    console.log(`Fetched ${tickers.length} tickers from API`);

    // Process in batches
    const batchSize = 100;
    
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      
      try {
        await Promise.all(
          batch.map(async (ticker) => {
            const newTicker: NewTicker = {
              symbol: ticker.symbol,
              name: ticker.name,
              market: ticker.market,
              locale: ticker.locale,
              primaryExchange: ticker.primaryExchange,
              type: ticker.type,
              active: ticker.active,
              currencyName: ticker.currencyName,
              cik: ticker.cik,
              compositeFigi: ticker.compositeFigi,
              updatedAt: new Date(),
            };

            // Upsert ticker
            await db
              .insert(schema.tickers)
              .values(newTicker)
              .onConflictDoUpdate({
                target: schema.tickers.symbol,
                set: {
                  name: newTicker.name,
                  market: newTicker.market,
                  locale: newTicker.locale,
                  primaryExchange: newTicker.primaryExchange,
                  type: newTicker.type,
                  active: newTicker.active,
                  currencyName: newTicker.currencyName,
                  cik: newTicker.cik,
                  compositeFigi: newTicker.compositeFigi,
                  updatedAt: new Date(),
                },
              });

            synced++;
          })
        );
      } catch (error) {
        console.error(`Failed to sync batch starting at ${i}:`, error);
        errors += batch.length;
      }

      // Progress log
      if ((i + batchSize) % 1000 === 0) {
        console.log(`Processed ${Math.min(i + batchSize, tickers.length)}/${tickers.length} tickers`);
      }
    }

    console.log(`Ticker sync complete. Synced: ${synced}, Errors: ${errors}`);
  } catch (error) {
    console.error('Ticker sync failed:', error);
    throw error;
  }

  return { synced, errors };
}

// Mark inactive tickers
export async function markInactiveTickers(activeSymbols: string[]): Promise<number> {
  if (activeSymbols.length === 0) return 0;

  const activeSet = new Set(activeSymbols);
  
  // Get all current tickers
  const allTickers = await db.select({ symbol: schema.tickers.symbol }).from(schema.tickers);
  
  let markedInactive = 0;
  
  for (const ticker of allTickers) {
    if (!activeSet.has(ticker.symbol)) {
      await db
        .update(schema.tickers)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(schema.tickers.symbol, ticker.symbol));
      markedInactive++;
    }
  }

  return markedInactive;
}
