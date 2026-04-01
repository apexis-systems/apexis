import cron from 'node-cron';
import { generateAllReports } from './controllers/reportController.ts';

export const startCronJobs = () => {
    // Daily report — every day at 11:59 PM IST (which is 06:29 PM UTC)
    // 29 18 * * * means 18:29 UTC
    cron.schedule('29 18 * * *', async () => {
        console.log('[cron] Generating daily reports...');
        await generateAllReports('daily');
    });

    // Weekly report — Every Sunday at 11:59 PM IST (which is 06:29 PM UTC Sunday)
    cron.schedule('29 18 * * 0', async () => {
        console.log('[cron] Generating weekly reports...');
        await generateAllReports('weekly');
    });

    // Monthly report — Last day of every month at 11:59 PM IST (which is 06:29 PM UTC)
    cron.schedule('29 18 28-31 * *', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (tomorrow.getDate() === 1) {
            console.log('[cron] Generating monthly reports...');
            await generateAllReports('monthly');
        }
    });

    console.log('[cron] Scheduled for 23:59 IST: daily (everyday), weekly (Sunday), monthly (last day)');

};
