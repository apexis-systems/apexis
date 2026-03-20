import type { Request, Response } from 'express';
import {
    projects, snags, activities, comments, users, files,
    Sequelize
} from '../models/index.ts';
import { Op } from 'sequelize';

export const getOverview = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { organization_id } = req.query;

        let orgFilter: any = {};
        if (user.role === 'admin') {
            orgFilter = { organization_id: user.organization_id };
        } else if (user.role === 'superadmin' && organization_id) {
            orgFilter = { organization_id };
        }

        // 1. Fetch Projects with basic stats
        const allProjects = await projects.findAll({
            where: orgFilter,
            include: [
                { model: users, attributes: ['name'], as: 'user' } // This is 'created_by' in index.ts
            ]
        });

        // 2. Fetch all Snags for these projects
        const projectIds = allProjects.map((p: any) => p.id);
        const allSnags = await snags.findAll({
            where: { project_id: { [Op.in]: projectIds } }
        });

        // 3. Fetch Activities
        const recentActivities = await activities.findAll({
            where: { project_id: { [Op.in]: projectIds } },
            include: [{ model: users, as: 'user', attributes: ['name'] }],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        // 4. Fetch Comments for last 7 days
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const recentComments = await comments.findAll({
            where: { createdAt: { [Op.gte]: lastWeek } },
            include: [{
                model: files,
                where: { project_id: { [Op.in]: projectIds } },
                attributes: ['project_id']
            }]
        });

        // 5. File Uploads Timeline
        const fileUploads = await files.findAll({
            where: {
                project_id: { [Op.in]: projectIds },
                createdAt: { [Op.gte]: lastWeek }
            },
            attributes: [
                [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'day'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
            ],
            group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))]
        });

        // --- Data Aggregation ---

        // Quick Stats
        const activeProjects = allProjects.filter((p: any) => p.status !== 'completed').length;
        const pendingTasks = allSnags.filter((s: any) => s.status !== 'green').length;
        const overdueTasks = allSnags.filter((s: any) => s.status === 'red').length; // Assuming red is overdue/critical
        const delayedProjects = allProjects.filter((p: any) => p.status === 'delayed').length;

        // Project Status Donut
        const statusCounts = [
            { name: 'On Track', value: allProjects.filter((p: any) => p.status === 'on-track').length, color: '#22c55e' },
            { name: 'Delayed', value: allProjects.filter((p: any) => p.status === 'delayed').length, color: '#ef4444' },
            { name: 'At Risk', value: allProjects.filter((p: any) => p.status === 'at-risk').length, color: '#f59e0b' },
            { name: 'Completed', value: allProjects.filter((p: any) => p.status === 'completed').length, color: '#3b82f6' },
        ];

        // Project Pulse Scores
        const projectPulse = allProjects.map((p: any) => {
            const pSnags = allSnags.filter((s: any) => s.project_id === p.id);
            const total = pSnags.length;
            const completed = pSnags.filter((s: any) => s.status === 'green').length;
            const overdue = pSnags.filter((s: any) => s.status === 'red').length;

            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            const pulseScore = Math.max(0, 100 - (overdue * 10) - (pSnags.filter((s: any) => s.status === 'amber').length * 5));

            return {
                id: p.id,
                name: p.name,
                pulseScore,
                progress,
                tasksDone: completed,
                tasksTotal: total,
                overdue,
                messages: recentComments.filter((c: any) => c.file?.project_id === p.id).length,
                risk: pulseScore > 85 ? 'low' : pulseScore > 65 ? 'medium' : 'high',
                architect: p.user?.name || 'Unassigned'
            };
        });

        // Team Leaderboard
        const teamStats: any = {};
        allSnags.forEach((s: any) => {
            if (!s.assigned_to) return;
            if (!teamStats[s.assigned_to]) {
                teamStats[s.assigned_to] = { id: s.assigned_to, name: 'User', tasksCompleted: 0, total: 0 };
            }
            teamStats[s.assigned_to].total++;
            if (s.status === 'green') teamStats[s.assigned_to].tasksCompleted++;
        });

        // Fetch names for leaderboard
        const teamUserIds = Object.keys(teamStats);
        const teamUsers = await users.findAll({
            where: { id: { [Op.in]: teamUserIds } },
            attributes: ['id', 'name', 'role']
        });

        const teamLeaderboard = teamUsers.map((u: any) => ({
            ...teamStats[u.id],
            name: u.name,
            role: u.role,
            avgResponseTime: '2.4 hrs' // Mocked as we don't track response time yet
        })).sort((a: any, b: any) => b.tasksCompleted - a.tasksCompleted);

        // Activity Feed
        const activityFeed = recentActivities.map((a: any) => ({
            id: a.id,
            type: a.type,
            description: a.description,
            project: a.project?.name || 'Unknown Project',
            user: a.user?.name || 'System',
            time: formatTimeAgo(a.createdAt)
        }));

        // File Uploads Timeline
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const uploadsMap: any = {};
        fileUploads.forEach((f: any) => {
            const dayName = days[new Date(f.dataValues.day).getDay()];
            uploadsMap[dayName] = parseInt(f.dataValues.count, 10);
        });
        const fileUploadTimeline = days.map(d => ({ day: d, uploads: uploadsMap[d] || 0 }));

        // App Usage (Mocked/Simple count)
        const totalUsers = await users.count({ where: orgFilter });
        const appUsage = {
            dailyActive: Math.ceil(totalUsers * 0.6),
            weeklyActive: Math.ceil(totalUsers * 0.8),
            total: totalUsers,
            engagement: 75,
            mostActive: projectPulse.sort((a: any, b: any) => b.messages - a.messages)[0]?.name || 'N/A',
            leastActive: projectPulse.sort((a: any, b: any) => a.messages - b.messages)[0]?.name || 'N/A'
        };

        res.json({
            quickStats: {
                activeProjects,
                pendingTasks,
                overdueTasks,
                delayedProjects,
                engagementPercent: 75
            },
            projectStatus: statusCounts,
            projectPulse,
            teamLeaderboard,
            activityFeed,
            fileUploadTimeline,
            appUsage,
            communication: projectPulse.map((p: any) => ({ project: p.name, messages: p.messages, avgReplyHrs: 3.0 })),
            pendingApprovals: [], // Mocked as no approval model exists
            taskCompletion: [ // Mocked weekly trend
                { week: 'W1', completed: 18, created: 25 },
                { week: 'W2', completed: 22, created: 20 },
                { week: 'W3', completed: 15, created: 28 },
                { week: 'W4', completed: 30, created: 22 },
            ]
        });

    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};

function formatTimeAgo(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hrs ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min ago";
    return Math.floor(seconds) + " sec ago";
}
