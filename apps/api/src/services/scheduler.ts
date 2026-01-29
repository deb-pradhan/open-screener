import { dataSyncService } from './data-sync';

/**
 * Scheduler for data synchronization
 * 
 * Schedule:
 * - Hourly sync: Every hour during market hours (9:30 AM - 4 PM ET, Mon-Fri)
 * - Daily sync: 4:30 PM ET on trading days
 * 
 * Note: Railway supports cron jobs natively, but this provides a fallback
 * for local development or if you prefer in-process scheduling.
 */
export class Scheduler {
  private hourlyInterval: ReturnType<typeof setInterval> | null = null;
  private dailyTimeout: ReturnType<typeof setTimeout> | null = null;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Start the scheduler
   */
  start(): void {
    console.log('Starting data sync scheduler...');
    
    // Initial sync on startup (only in production)
    if (this.isProduction) {
      this.runInitialSync();
    }

    // Schedule hourly sync
    this.scheduleHourlySync();
    
    // Schedule daily sync
    this.scheduleDailySync();
    
    console.log('Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.hourlyInterval) {
      clearInterval(this.hourlyInterval);
      this.hourlyInterval = null;
    }
    if (this.dailyTimeout) {
      clearTimeout(this.dailyTimeout);
      this.dailyTimeout = null;
    }
    console.log('Scheduler stopped');
  }

  /**
   * Run initial sync on startup
   */
  private async runInitialSync(): Promise<void> {
    console.log('Running initial sync...');
    
    try {
      // Check if we have recent data
      const lastSync = await dataSyncService.getLastSyncTime();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (!lastSync || lastSync < oneHourAgo) {
        console.log('Data is stale or missing, running snapshot sync...');
        await dataSyncService.syncHourlySnapshot();
      } else {
        console.log('Recent data exists, skipping initial sync');
      }
    } catch (error) {
      console.error('Initial sync failed:', error);
    }
  }

  /**
   * Schedule hourly snapshot sync
   * Runs every hour on the hour
   */
  private scheduleHourlySync(): void {
    // Calculate time until next hour
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const msUntilNextHour = nextHour.getTime() - now.getTime();

    // Start at the next hour, then run every hour
    setTimeout(() => {
      this.runHourlySync();
      
      // Then run every hour
      this.hourlyInterval = setInterval(() => {
        this.runHourlySync();
      }, 60 * 60 * 1000); // 1 hour
      
    }, msUntilNextHour);

    console.log(`Hourly sync scheduled, first run in ${Math.round(msUntilNextHour / 1000 / 60)} minutes`);
  }

  /**
   * Run hourly sync if during market hours
   */
  private async runHourlySync(): Promise<void> {
    if (!this.isMarketHours()) {
      console.log('Outside market hours, skipping hourly sync');
      return;
    }

    console.log('Running scheduled hourly sync...');
    
    try {
      const result = await dataSyncService.syncHourlySnapshot();
      console.log(`Hourly sync complete: ${result.processed} processed`);
    } catch (error) {
      console.error('Scheduled hourly sync failed:', error);
    }
  }

  /**
   * Schedule daily sync at 4:30 PM ET
   */
  private scheduleDailySync(): void {
    const scheduleNext = () => {
      const msUntilDailySync = this.getMsUntilDailySync();
      
      this.dailyTimeout = setTimeout(async () => {
        await this.runDailySync();
        scheduleNext(); // Schedule next day
      }, msUntilDailySync);
      
      const hours = Math.round(msUntilDailySync / 1000 / 60 / 60);
      console.log(`Daily sync scheduled in ${hours} hours`);
    };

    scheduleNext();
  }

  /**
   * Run daily sync
   */
  private async runDailySync(): Promise<void> {
    if (!this.isTradingDay()) {
      console.log('Not a trading day, skipping daily sync');
      return;
    }

    console.log('Running scheduled daily sync...');
    
    try {
      const result = await dataSyncService.syncDailyData();
      console.log(`Daily sync complete: ${result.processed} processed, ${result.failed} failed`);
    } catch (error) {
      console.error('Scheduled daily sync failed:', error);
    }
  }

  /**
   * Check if current time is during US market hours
   * Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
   */
  private isMarketHours(): boolean {
    const now = new Date();
    const et = this.toEasternTime(now);
    
    const dayOfWeek = et.getDay();
    const hours = et.getHours();
    const minutes = et.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    // Monday = 1, Friday = 5
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    // 9:30 AM = 570 minutes, 4:00 PM = 960 minutes
    const isMarketOpen = timeInMinutes >= 570 && timeInMinutes <= 960;
    
    return isWeekday && isMarketOpen;
  }

  /**
   * Check if today is a trading day (weekday)
   * Note: This doesn't account for holidays
   */
  private isTradingDay(): boolean {
    const now = new Date();
    const et = this.toEasternTime(now);
    const dayOfWeek = et.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * Calculate milliseconds until 4:30 PM ET
   */
  private getMsUntilDailySync(): number {
    const now = new Date();
    const et = this.toEasternTime(now);
    
    // Target: 4:30 PM ET (16:30)
    const targetHour = 16;
    const targetMinute = 30;
    
    const target = new Date(et);
    target.setHours(targetHour, targetMinute, 0, 0);
    
    // If we've passed today's target, schedule for tomorrow
    if (et >= target) {
      target.setDate(target.getDate() + 1);
    }
    
    // Skip weekends
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() + 1);
    }
    
    return target.getTime() - now.getTime();
  }

  /**
   * Convert a date to Eastern Time
   */
  private toEasternTime(date: Date): Date {
    // Use Intl to get ET time parts
    const etString = date.toLocaleString('en-US', { timeZone: 'America/New_York' });
    return new Date(etString);
  }
}

// Singleton instance
export const scheduler = new Scheduler();
