import cron from 'node-cron';
import { generateAllReports } from './controllers/reportController.ts';
import { rfis } from './models/index.ts';
import { Op } from 'sequelize';
import { getIO } from './socket.ts';

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

    // RFI Overdue check — Every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('[cron] Checking for overdue RFIs...');
        try {
            const now = new Date();
            
            // Find which projects have overdue RFIs first so we can emit to them
            const overdue = await rfis.findAll({
                where: {
                    status: 'open',
                    expiry_date: { [Op.lt]: now }
                },
                attributes: ['project_id'],
                raw: true
            });

            if (overdue.length > 0) {
                const projectIds = [...new Set(overdue.map((r: any) => r.project_id))];
                
                const [count] = await rfis.update(
                    { status: 'overdue' },
                    {
                        where: {
                            status: 'open',
                            expiry_date: { [Op.lt]: now }
                        }
                    }
                );

                console.log(`[cron] Marked ${count} RFIs as overdue across ${projectIds.length} projects.`);

                // Emit to all affected projects
                const io = getIO();
                projectIds.forEach(pid => {
                    io.to(`project-${pid}`).emit('rfi-updated', { project_id: pid });
                });
            }
        } catch (err) {
            console.error('[cron] RFI overdue check error:', err);
        }
    });

    console.log('[cron] Scheduled for 23:59 IST: daily (everyday), weekly (Sunday), monthly (last day)');

};
