import cron from 'node-cron';
import { generateAllReports } from './controllers/reportController.ts';
import { rfis, projects } from './models/index.ts';
import { Op } from 'sequelize';
import { getIO } from './socket.ts';

export const startCronJobs = () => {
    // Daily report — every day at 08:00 PM IST (which is 02:30 PM UTC)
    // 30 14 * * * means 14:30 UTC
    cron.schedule('30 14 * * *', async () => {
        console.log('[cron] Generating daily reports...');
        await generateAllReports('daily');
    });

    // Weekly report — Every Sunday at 08:00 PM IST (which is 02:30 PM UTC Sunday)
    cron.schedule('30 14 * * 0', async () => {
        console.log('[cron] Generating weekly reports...');
        await generateAllReports('weekly');
    });

    // Monthly report — Last day of every month at 08:00 PM IST (which is 02:30 PM UTC)
    cron.schedule('30 14 28-31 * *', async () => {
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
    
    // Project Trash Purge — Every day at Midnight UTC (05:30 AM IST)
    cron.schedule('0 0 * * *', async () => {
        console.log('[cron] Purging projects in trash for > 30 days...');
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Find soft-deleted projects older than 30 days
            const trashedProjects = await projects.findAll({
                where: {
                    deletedAt: { [Op.lte]: thirtyDaysAgo }
                },
                paranoid: false,
                attributes: ['id', 'organization_id']
            });

            if (trashedProjects.length > 0) {
                console.log(`[cron] Found ${trashedProjects.length} projects to purge.`);
                const { permanentlyDeleteProject } = await import('./services/projectService.ts');
                
                for (const project of trashedProjects) {
                    try {
                        await permanentlyDeleteProject(project.id, project.organization_id);
                        console.log(`[cron] Purged project ID: ${project.id}`);
                    } catch (err) {
                        console.error(`[cron] Failed to purge project ${project.id}:`, err);
                    }
                }
            }
        } catch (err) {
            console.error('[cron] Project trash purge error:', err);
        }
    });

    console.log('[cron] Scheduled for 20:00 IST: daily (everyday), weekly (Sunday), monthly (last day)');
    console.log('[cron] Scheduled for 00:00 UTC: Project Trash Purge (30 days)');

};
