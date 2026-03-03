import cron from 'node-cron';
import { generateAllReports } from './controllers/reportController.ts';

export const startCronJobs = () => {
    // Daily report — every day at 11:59 PM
    cron.schedule('59 23 * * *', async () => {
        console.log('[cron] Generating daily reports...');
        await generateAllReports('daily');
    });

    // Weekly report — every Sunday at 11:59 PM
    cron.schedule('59 23 * * 0', async () => {
        console.log('[cron] Generating weekly reports...');
        await generateAllReports('weekly');
    });

    console.log('[cron] Scheduled: daily (23:59 daily) + weekly (23:59 Sunday)');
};
