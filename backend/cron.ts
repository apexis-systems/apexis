import cron from 'node-cron';
import { generateAllReports } from './controllers/reportController.ts';

export const startCronJobs = () => {
    // Daily report — every day at 11:59 PM
    cron.schedule('59 23 * * *', async () => {
        console.log('[cron] Generating daily reports...');
        await generateAllReports('daily');
    });

    // Monthly report — Last day of every month at 11:59 PM
    cron.schedule('59 23 28-31 * *', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (tomorrow.getDate() === 1) {
            console.log('[cron] Generating monthly reports...');
            await generateAllReports('monthly');
        }
    });

    console.log('[cron] Scheduled: daily (23:59 daily), weekly (23:59 Sunday), monthly (23:59 last day)');

};
