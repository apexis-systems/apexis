import { Op, fn, col, literal } from "sequelize";
import {
    users,
    projects,
    organizations,
    snags,
    rfis,
    chat_messages,
    files,
    transactions,
    activities,
    plans,
    rooms,
    reports,
    manuals
} from "../models/index.ts";

const calcGrowth = (current: number, previous: number) => {
    if (previous === 0) {
        return {
            text: current > 0 ? "+100%" : "0%",
            type: current > 0 ? "up" as const : "neutral" as const
        };
    }
    const pct = ((current - previous) / previous) * 100;
    const trend = pct >= 0 ? "up" : "down";
    return {
        text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
        type: trend as "up" | "down" | "neutral"
    };
};

export const getDashboardOverviewStats = async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch CURRENT TOTALS (Total till now)
    const [
        totalCompanies,
        totalProjects,
        totalUsers,
        totalMessages,
        totalSnags,
        totalDAU
    ] = await Promise.all([
        organizations.count(),
        projects.count(),
        users.count(),
        chat_messages.count(),
        snags.count({ where: { status: "green" } }),
        activities.count({ col: 'user_id', distinct: true })
    ]);

    const fetchRangeStats = async (comparisonDate: Date, isAllTime: boolean = false) => {
        // For All Time, previous is always 0 because we started from 0
        const [
            prevCompanies,
            prevProjects,
            prevUsers,
            prevMessages,
            prevSnags,
            prevDAU
        ] = isAllTime ? [0, 0, 0, 0, 0, 0] : await Promise.all([
            organizations.count({ where: { createdAt: { [Op.lt]: comparisonDate } } }),
            projects.count({ where: { createdAt: { [Op.lt]: comparisonDate } } }),
            users.count({ where: { createdAt: { [Op.lt]: comparisonDate } } }),
            chat_messages.count({ where: { createdAt: { [Op.lt]: comparisonDate } } }),
            snags.count({ where: { status: "green", updatedAt: { [Op.lt]: comparisonDate } } }),
            activities.count({ col: 'user_id', distinct: true, where: { createdAt: { [Op.lt]: comparisonDate } } })
        ]);

        return {
            activeCompanies: { total: totalCompanies, ...calcGrowth(totalCompanies, prevCompanies) },
            activeProjects: { total: totalProjects, ...calcGrowth(totalProjects, prevProjects) },
            totalUsers: { total: totalUsers, ...calcGrowth(totalUsers, prevUsers) },
            dailyActiveUsers: { total: totalDAU, ...calcGrowth(totalDAU, prevDAU) },
            tasksCompletedToday: { total: totalSnags, ...calcGrowth(totalSnags, prevSnags) },
            messagesSentToday: { total: totalMessages, ...calcGrowth(totalMessages, prevMessages) },
        };
    };

    const [todayRange, sevenDays, thirtyDays, allTime] = await Promise.all([
        fetchRangeStats(oneDayAgo),
        fetchRangeStats(sevenDaysAgo),
        fetchRangeStats(thirtyDaysAgo),
        fetchRangeStats(new Date(0), true)
    ]);

    return {
        today: todayRange,
        "7days": sevenDays,
        "30days": thirtyDays,
        allTime,
        rfisPending: await rfis.count({ where: { status: 'open' } }),
        drawingsUploadedToday: await files.count({
            where: {
                createdAt: { [Op.gte]: oneDayAgo },
                file_type: { [Op.like]: 'image/%' }
            }
        }),
        systemHealth: {
            uptime: "99.98%",
            responseTime: "124ms",
            storageUsed: "1.2 TB",
            failedUploads: "0.01%"
        },
        userBehavior: {
            avgSessionTime: "14 min",
            sessionsPerDay: "4.2"
        }
    };
};

export const getTopActiveProjects = async () => {
    // Get top 5 projects by activity count in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = await activities.findAll({
        attributes: [
            'project_id',
            [fn('COUNT', col('activities.id')), 'activity_count']
        ],
        where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
        group: ['project_id'],
        order: [[literal('activity_count'), 'DESC']],
        limit: 5,
        raw: true
    });

    return Promise.all(stats.map(async (stat: any) => {
        const projectId = stat.project_id;
        const project = await projects.findByPk(projectId, {
            include: [{
                model: organizations,
                as: 'organization',
                attributes: ['id', 'name']
            }]
        });
        const [taskCount, messageCount] = await Promise.all([
            snags.count({ where: { project_id: projectId } }),
            chat_messages.count({
                include: [{
                    model: rooms,
                    where: { project_id: projectId },
                    required: true
                }]
            })
        ]);

        return {
            name: project?.name || "Unknown",
            company: (project as any)?.organization?.name || "Unknown",
            activity: parseInt(stat.activity_count),
            risk: parseInt(stat.activity_count) > 100 ? 'green' : (parseInt(stat.activity_count) > 50 ? 'yellow' : 'red'),
            tasks: taskCount,
            messages: messageCount
        };
    }));
};

export const getPlatformGrowthData = async () => {
    // Return last 8 months of growth
    const months: any[] = [];
    for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

        const [companyCount, projectCount, userCount] = await Promise.all([
            organizations.count({ where: { createdAt: { [Op.lte]: endOfMonth } } }),
            projects.count({ where: { createdAt: { [Op.lte]: endOfMonth } } }),
            users.count({ where: { createdAt: { [Op.lte]: endOfMonth } } })
        ]);

        months.push({
            month: d.toLocaleString('default', { month: 'short' }),
            companies: companyCount,
            projects: projectCount,
            users: userCount
        });
    }
    return months;
};

export const getProjectActivityData = async () => {
    // Last 14 days of snag creation vs completion
    const days: any[] = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const startOfDay = new Date(d.setHours(0, 0, 0, 0));
        const endOfDay = new Date(d.setHours(23, 59, 59, 999));

        const [created, completed] = await Promise.all([
            snags.count({ where: { createdAt: { [Op.between]: [startOfDay, endOfDay] } } }),
            snags.count({ where: { status: "green", updatedAt: { [Op.between]: [startOfDay, endOfDay] } } })
        ]);

        days.push({
            day: `Day ${14 - i}`,
            created,
            completed
        });
    }
    return days;
};

export const getCommunicationStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const messages = await chat_messages.count({
        where: { createdAt: { [Op.gte]: today } }
    });

    // File breakdown by type
    const fileStats = await files.findAll({
        attributes: [
            [fn('COUNT', col('id')), 'count'],
            [literal("CASE WHEN file_type LIKE 'image/%' THEN 'Photos' WHEN file_type = 'application/pdf' THEN 'PDFs' ELSE 'Other' END"), 'type']
        ],
        group: ['type']
    });

    const last7Days: any[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const startOfDay = new Date(d.setHours(0, 0, 0, 0));
        const endOfDay = new Date(d.setHours(23, 59, 59, 999));

        const count = await chat_messages.count({
            where: { createdAt: { [Op.between]: [startOfDay, endOfDay] } }
        });

        last7Days.push({
            day: d.toLocaleString('default', { weekday: 'short' }),
            messages: count
        });
    }

    return {
        messagesToday: messages,
        messagesTrend: last7Days,
        filesBreakdown: fileStats.map((f: any) => ({
            type: f.getDataValue('type'),
            count: parseInt(f.getDataValue('count'))
        }))
    };
};

export const getRevenueAnalytics = async () => {
    const mrr = await transactions.sum('payment_amount', {
        where: { payment_status: 'success' } // Very basic MRR calculation for now
    }) || 0;

    const [freeUsers, paidUsers] = await Promise.all([
        users.count({
            where: { organization_id: null } // Assuming no org means free user
        }),
        users.count({
            where: { organization_id: { [Op.ne]: null } }
        })
    ]);

    const [totalPaidOrgs, churnedOrgs] = await Promise.all([
        organizations.count({
            where: { plan_price: { [Op.gt]: 0 } }
        }),
        organizations.count({
            where: {
                plan_price: { [Op.gt]: 0 },
                plan_end_date: { [Op.lt]: new Date() }
            }
        })
    ]);

    return {
        mrr: mrr,
        arr: mrr * 12,
        projectedMRR: mrr * 1.12,
        freeUsers,
        paidUsers,
        conversionRate: freeUsers > 0 ? ((paidUsers / (freeUsers + paidUsers)) * 100).toFixed(1) : 0,
        churnRate: totalPaidOrgs > 0 ? ((churnedOrgs / totalPaidOrgs) * 100).toFixed(1) : 0
    };
};

export const getFeedbackData = async () => {
    return [
        { reason: "Too expensive", count: 12 },
        { reason: "Missing features", count: 8 },
        { reason: "Switched to competitor", count: 15 },
        { reason: "Project ended", count: 24 },
        { reason: "Other", count: 5 },
    ];
};

export const getFreemiumLeads = async () => {
    // Fetch users who are part of an organization on the 'Free' (Freemium) plan
    const freemiumUsers = await users.findAll({
        where: { role: 'admin' },
        include: [{
            model: organizations,
            where: { plan_name: 'Freemium' },
            required: true,
            attributes: ['id', 'name', 'plan_start_date', 'plan_end_date']
        }],
        attributes: ['id', 'name', 'email', 'phone_number', 'createdAt'],
        order: [['createdAt', 'DESC']]
    });

    return await Promise.all(freemiumUsers.map(async (u: any) => {
        const org = u.organization;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Fetch dynamic metrics for each lead
        const [activityCount, recentActivity, transactionCount] = await Promise.all([
            activities.count({ where: { user_id: u.id, createdAt: { [Op.gte]: thirtyDaysAgo } } }),
            activities.count({ where: { user_id: u.id, createdAt: { [Op.gte]: sevenDaysAgo } } }),
            transactions.count({ where: { organization_id: org?.id, payment_status: 'success' } })
        ]);

        const createdAt = new Date(u.createdAt);
        const planStart = org?.plan_start_date ? new Date(org.plan_start_date) : createdAt;
        const planEnd = org?.plan_end_date ? new Date(org.plan_end_date) : new Date(planStart.getTime() + 14 * 24 * 60 * 60 * 1000);

        const diffTime = planEnd.getTime() - now.getTime();
        const remaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone_number || "+91 0000000000",
            company: org?.name || "Individual / Startup",
            installDate: u.createdAt,
            trialStart: planStart.toISOString(),
            trialEnd: planEnd.toISOString(),
            remaining: remaining > 0 ? remaining : 0,
            daysUsed: Math.max(0, Math.floor((now.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24))),
            activityScore: Math.min(100, Math.floor((activityCount / 30) * 100)), // 30+ activities in 30 days = 100 score
            isActive: recentActivity > 0, // Active if any activity in last 7 days
            converted: transactionCount > 0 // True if they've ever made a successful payment
        };
    }));
};

export const getSaasGrowthAnalytics = async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch CURRENT TOTALS (Total till now)
    const [
        totalUsers,
        totalCompanies,
        totalProjects,
        totalPaid,
        totalRevenue
    ] = await Promise.all([
        users.count(),
        organizations.count(),
        projects.count(),
        transactions.count({ where: { payment_status: 'success' }, col: 'user_id', distinct: true }),
        transactions.sum('payment_amount', { where: { payment_status: 'success' } })
    ]);

    const currentRevenue = Number(totalRevenue || 0);
    const currentFree = totalUsers - totalPaid;
    const currentConv = totalUsers > 0 ? (totalPaid / totalUsers) * 100 : 0;

    const fetchRangeMetrics = async (comparisonDate: Date, isAllTime: boolean = false) => {
        const [
            prevUsers,
            prevCompanies,
            prevProjects,
            prevPaid,
            prevRevenue
        ] = isAllTime ? [0, 0, 0, 0, 0] : await Promise.all([
            users.count({ where: { createdAt: { [Op.lt]: comparisonDate } } }),
            organizations.count({ where: { createdAt: { [Op.lt]: comparisonDate } } }),
            projects.count({ where: { createdAt: { [Op.lt]: comparisonDate } } }),
            transactions.count({ where: { payment_status: 'success', created_at: { [Op.lt]: comparisonDate } }, col: 'user_id', distinct: true }),
            transactions.sum('payment_amount', { where: { payment_status: 'success', created_at: { [Op.lt]: comparisonDate } } })
        ]);

        const previousRevenue = Number(prevRevenue || 0);
        const prevFree = prevUsers - prevPaid;
        const prevConv = prevUsers > 0 ? (prevPaid / prevUsers) * 100 : 0;

        return {
            totalUsers: { total: totalUsers, ...calcGrowth(totalUsers, prevUsers) },
            activeCompanies: { total: totalCompanies, ...calcGrowth(totalCompanies, prevCompanies) },
            activeProjects: { total: totalProjects, ...calcGrowth(totalProjects, prevProjects) },
            paidSubscribers: { total: totalPaid, ...calcGrowth(totalPaid, prevPaid) },
            mrr: { total: currentRevenue, ...calcGrowth(currentRevenue, previousRevenue) },
            arr: { total: currentRevenue * 12, ...calcGrowth(currentRevenue, previousRevenue) },
            freemiumUsers: { total: currentFree, ...calcGrowth(currentFree, prevFree) },
            arpu: totalUsers > 0 ? (currentRevenue / totalUsers).toFixed(0) : 0,
            conversionRate: { total: currentConv.toFixed(1) + "%", ...calcGrowth(currentConv, prevConv) }
        };
    };

    const [todayStats, sevenDaysStats, thirtyDaysStats, allTimeStats, plansList] = await Promise.all([
        fetchRangeMetrics(oneDayAgo),
        fetchRangeMetrics(sevenDaysAgo),
        fetchRangeMetrics(thirtyDaysAgo),
        fetchRangeMetrics(new Date(0), true),
        plans.findAll()
    ]);


    // Use All Time Stats for general context like Funnel and Plan Breakdown
    const funnel = [
        { stage: "Signed Up", value: totalUsers, pct: 100 },
        { stage: "Started Trial", value: Math.floor(totalUsers * 0.8), pct: 80.1 },
        { stage: "Actively Using", value: Math.floor(totalUsers * 0.52), pct: 52.1 },
        { stage: "Converted to Paid", value: totalPaid, pct: ((totalPaid / totalUsers) * 100).toFixed(1) },
    ];

    // Plan breakdown
    const planCounts = await Promise.all(plansList.map(async (plan: any) => {
        const count = await transactions.count({
            where: { payment_status: 'success', subscription_tier: plan.name },
            col: 'user_id',
            distinct: true
        });
        const revenue = await transactions.sum('payment_amount', {
            where: { payment_status: 'success', subscription_tier: plan.name }
        }) || 0;

        return {
            name: plan.name,
            value: count,
            revenue,
            arpu: count > 0 ? Number((Number(revenue) / count).toFixed(2)) : 0,
            color: plan.name.includes("Professional") ? "#e98b06" : "hsl(25, 95%, 53%)"
        };
    }));

    // Churn calculation
    const [totalPaidOrgs, churnedOrgs] = await Promise.all([
        organizations.count({ where: { plan_price: { [Op.gt]: 0 } } }),
        organizations.count({
            where: {
                plan_price: { [Op.gt]: 0 },
                plan_end_date: { [Op.lt]: new Date() }
            }
        })
    ]);
    const churnRate = totalPaidOrgs > 0 ? ((churnedOrgs / totalPaidOrgs) * 100).toFixed(1) + "%" : "0%";

    // Daily User Growth for the last 7 days
    const dailyGrowth: any[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const startOfDay = new Date(d.setHours(0, 0, 0, 0));
        const endOfDay = new Date(d.setHours(23, 59, 59, 999));
        const count = await users.count({ where: { createdAt: { [Op.between]: [startOfDay, endOfDay] } } });
        dailyGrowth.push({ day: d.toLocaleString('default', { weekday: 'short' }), users: count });
    }

    return {
        today: todayStats,
        "7days": sevenDaysStats,
        "30days": thirtyDaysStats,
        allTime: allTimeStats,
        funnel,
        planBreakdown: planCounts,
        dailyGrowth,
        churnRate,
        trialCompletionRate: "80.1%",
        expansionRevenue: "+8.6%"
    };
};

export const getRevenueGrowthData = async () => {
    const months: any[] = [];
    const plansList = await plans.findAll();

    for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

        // Calculate per-plan revenue for THIS SPECIFIC month
        const planData: any = {};
        let monthlyTotal = 0;

        for (const plan of plansList) {
            const planRevenue = await transactions.sum('payment_amount', {
                where: {
                    payment_status: 'success',
                    subscription_tier: plan.name,
                    created_at: { [Op.between]: [startOfMonth, endOfMonth] }
                }
            }) || 0;

            const key = plan.name.toLowerCase();
            planData[key] = planRevenue;
            monthlyTotal += planRevenue;
        }

        months.push({
            month: d.toLocaleString('default', { month: 'short' }),
            mrr: monthlyTotal,
            ...planData
        });
    }
    return months;
};

export const getDetailedAccountsList = async () => {
    const orgs = await organizations.findAll({
        include: [{
            model: plans,
            as: 'plan'
        }, {
            model: users,
            as: 'users',
            attributes: ['id', 'name', 'email', 'role']
        }]
    });

    return orgs.map((org: any) => {
        const owner = org.users?.find((u: any) => u.role === 'admin') || org.users?.[0];
        return {
            id: org.id.toString(),
            name: owner?.name || "Unknown Owner",
            email: owner?.email || "No Email",
            company: org.name,
            plan: org.plan?.name || "Freemium",
            status: "Active",
            amount: `₹${org.plan?.price || 0}`,
            renewalDate: "2026-12-31",
            usage: org.plan?.storage_gb ? Math.round((org.storage_used_mb / (org.plan.storage_gb * 1024)) * 100) : 0,
            riskLevel: "Low",
            contacted: false
        };
    });
};

export const getChurnAndRetentionMetrics = async () => {
    const totalUsers = await users.count();
    const paidSubscribers = await transactions.count({
        where: { payment_status: 'success' },
        col: 'user_id',
        distinct: true
    });

    const [totalPaidOrgs, churnedOrgs] = await Promise.all([
        organizations.count({
            where: { plan_price: { [Op.gt]: 0 } }
        }),
        organizations.count({
            where: {
                plan_price: { [Op.gt]: 0 },
                plan_end_date: { [Op.lt]: new Date() }
            }
        })
    ]);

    const churnRate = totalPaidOrgs > 0 ? Number(((churnedOrgs / totalPaidOrgs) * 100).toFixed(1)) : 0;

    return {
        churnMetrics: {
            activeSubscribers: { value: paidSubscribers, growth: 15.7 },
            cancelledSubscriptions: { value: churnedOrgs, growth: 0 },
            monthlyChurnRate: { value: churnRate, growth: 0 },
            revenueLost: { value: 0, growth: 0 },
            clv: { value: 4520, growth: 6.4 },
        },
        retentionData: {
            avgLifetime: 8.4,
            renewalRate: 86.3,
            freemiumToPaid: totalUsers > 0 ? ((paidSubscribers / totalUsers) * 100).toFixed(1) : 0,
            paidToRenewed: 82.7,
        },
        conversionFunnel: {
            trial0to30: await users.count({ where: { organization_id: null } }),
            trial30to60: 0,
            trialExpired: 0,
            converted: paidSubscribers,
        }
    };
};

export const getGlobalActivityFeed = async () => {
    const recentActivities = await activities.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [{
            model: users,
            as: 'user',
            attributes: ['name']
        }, {
            model: projects,
            as: 'project',
            attributes: ['name']
        }]
    });

    return recentActivities.map((act: any) => {
        const typeVerbs: Record<string, string> = {
            upload: "uploaded a file",
            upload_photo: "added a photo",
            uploaded: "uploaded content",
            comment: "commented",
            photo_comment: "commented on a photo",
            share: "shared a project",
            edit: "edited",
            delete: "deleted something"
        };
        const verb = typeVerbs[act.type] || act.type || "performed an action";

        return {
            icon: "Circle",
            text: `${act.user?.name || 'User'} ${verb} in ${act.project?.name || 'a project'}`,
            time: act.createdAt,
            type: act.type
        };
    });
};

export const getPlatformInsights = async () => {
    const [rfiCount, snagCount, photoCount, documentCount, chatRoomCount] = await Promise.all([
        rfis.count().catch(() => 0),
        snags.count().catch(() => 0),
        files.count({ where: { file_type: { [Op.like]: 'image/%' } } }).catch(() => 0),
        files.count({ where: { file_type: 'application/pdf' } }).catch(() => 0),
        rooms.count().catch(() => 0)
    ]);

    const totalUsage = rfiCount + snagCount + photoCount + documentCount + chatRoomCount;
    const calcPct = (count: number) => totalUsage > 0 ? Number(((count / totalUsage) * 100).toFixed(1)) : 0;

    return {
        features: [
            { name: "Chat", usage: calcPct(chatRoomCount), count: chatRoomCount },
            { name: "Snags", usage: calcPct(snagCount), count: snagCount },
            { name: "Photos", usage: calcPct(photoCount), count: photoCount },
            { name: "Documents", usage: calcPct(documentCount), count: documentCount },
            { name: "RFIs", usage: calcPct(rfiCount), count: rfiCount },
        ],
        insights: [
            { icon: "TrendingUp", text: "Organization adoption grew significantly this month." },
            { icon: "Lightbulb", text: "RFIs are being resolved faster than last quarter." }
        ]
    };
};

export const getPlatformAlerts = async () => {
    const alertsList: any[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Check for failed transactions in last 7 days
    const failedTrans = await transactions.findAll({
        where: {
            payment_status: 'failed',
            created_at: { [Op.gte]: sevenDaysAgo }
        },
        limit: 5,
        include: [{ model: organizations, attributes: ['name'] }]
    });

    failedTrans.forEach((t: any) => {
        alertsList.push({
            text: `Payment failed for organization: ${t.organization?.name || 'Unknown'}`,
            severity: 'critical',
            time: t.created_at
        });
    });

    // 2. Check for storage limits (> 80%)
    const storageAlerts = await organizations.findAll({
        where: literal('storage_used_mb >= storage_limit_mb * 0.8'),
        limit: 5
    });

    storageAlerts.forEach((org: any) => {
        const usage = Math.round((org.storage_used_mb / org.storage_limit_mb) * 100);
        alertsList.push({
            text: `Storage alert: ${org.name} has used ${usage}% of their limit`,
            severity: usage > 95 ? 'critical' : 'warning',
            time: org.updatedAt
        });
    });

    // 3. Check for expiring plans (within 7 days)
    const expiringPlans = await organizations.findAll({
        where: {
            plan_end_date: { [Op.between]: [now, sevenDaysFromNow] }
        },
        limit: 5
    });

    expiringPlans.forEach((org: any) => {
        alertsList.push({
            text: `Subscription for ${org.name} expires on ${new Date(org.plan_end_date).toLocaleDateString()}`,
            severity: 'warning',
            time: org.updatedAt
        });
    });

    // 4. Default info alerts if none found
    if (alertsList.length === 0) {
        alertsList.push({
            text: "Platform status: All systems operational. No critical issues detected.",
            severity: "info",
            time: now.toISOString()
        });
    }

    return alertsList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
};

export const getCompanyUsageData = async () => {
    const orgs = await organizations.findAll({
        attributes: ["id", "name"],
    });

    const companyUsage = await Promise.all(
        orgs.map(async (org: any) => {
            const [projectCount, userCount, messageCount, snagCount, rfiCount, photoCount, pdfCount] = await Promise.all([
                projects.count({ where: { organization_id: org.id } }),
                users.count({ where: { organization_id: org.id } }),
                chat_messages.count({
                    include: [
                        {
                            model: rooms,
                            where: { organization_id: org.id },
                            required: true,
                        },
                    ],
                }),
                snags.count({
                    include: [
                        {
                            model: projects,
                            where: { organization_id: org.id },
                            required: true,
                        },
                    ],
                }),
                rfis.count({
                    include: [
                        {
                            model: projects,
                            where: { organization_id: org.id },
                            required: true,
                        },
                    ],
                }),
                files.count({
                    include: [{
                        model: projects,
                        where: { organization_id: org.id },
                        required: true
                    }],
                    where: {
                        file_type: { [Op.like]: 'image/%' }
                    }
                }),
                files.count({
                    include: [{
                        model: projects,
                        where: { organization_id: org.id },
                        required: true
                    }],
                    where: {
                        file_type: 'application/pdf'
                    }
                })
            ]);

            return {
                id: org.id,
                name: org.name,
                projects: projectCount,
                users: userCount,
                messages: messageCount,
                tasks: snagCount + rfiCount,
                photos: photoCount,
                pdfs: pdfCount,
            };
        })
    );
    // Sort by most active (tasks + messages + projects)
    return companyUsage.sort((a: any, b: any) => b.tasks + b.messages + b.projects - (a.tasks + a.messages + a.projects));
};

export const getProductUsageData = async () => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

        const [projectCount, photoCount, pdfCount, messageCount, releaseCount] = await Promise.all([
            projects.count({ where: { createdAt: { [Op.lte]: endOfMonth } } }),
            files.count({
                where: {
                    file_type: { [Op.like]: 'image/%' },
                    createdAt: { [Op.lte]: endOfMonth }
                }
            }),
            files.count({
                where: {
                    file_type: 'application/pdf',
                    createdAt: { [Op.lte]: endOfMonth }
                }
            }),
            chat_messages.count({ where: { createdAt: { [Op.lte]: endOfMonth } } }),
            manuals.count({ where: { createdAt: { [Op.lte]: endOfMonth } } })
        ]);

        months.push({
            month: d.toLocaleString('default', { month: 'short' }),
            projects: projectCount,
            photos: photoCount,
            pdfs: pdfCount,
            messages: messageCount,
            releases: releaseCount
        });
    }
    return months;
};

export const getUserGrowthData = async () => {
    const months: any[] = [];
    for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

        const userCount = await users.count({
            where: { createdAt: { [Op.lte]: endOfMonth } }
        });

        months.push({
            month: d.toLocaleString('default', { month: 'short' }),
            users: userCount
        });
    }
    return months;
};

const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
};

export const getCompanyActivityData = async () => {
    const orgs = await organizations.findAll({
        include: [{
            model: plans,
            as: 'plan',
            attributes: ['name', 'price']
        }]
    });

    const activity = await Promise.all(orgs.map(async (org: any) => {
        const [projectCount, userCount, messageCount, photoCount, documentCount, lastAct] = await Promise.all([
            projects.count({ where: { organization_id: org.id } }),
            users.count({ where: { organization_id: org.id } }),
            chat_messages.count({
                include: [{ model: rooms, where: { organization_id: org.id }, required: true }]
            }),
            files.count({
                include: [{ model: projects, where: { organization_id: org.id }, required: true }],
                where: { file_type: { [Op.like]: 'image/%' } }
            }),
            files.count({
                include: [{ model: projects, where: { organization_id: org.id }, required: true }],
                where: { file_type: 'application/pdf' }
            }),
            activities.findOne({
                include: [{ model: projects, where: { organization_id: org.id }, required: true }],
                order: [['createdAt', 'DESC']]
            })
        ]);

        return {
            name: org.name,
            projects: projectCount,
            team: userCount,
            photos: photoCount,
            documents: documentCount,
            messages: messageCount,
            lastActive: lastAct ? formatRelativeTime(lastAct.createdAt) : "Never",
            lastActiveRaw: lastAct ? new Date(lastAct.createdAt).getTime() : 0,
            plan: org.plan?.name || "Free"
        };
    }));

    // Sort by most recent active
    return activity.sort((a: any, b: any) => b.lastActiveRaw - a.lastActiveRaw).slice(0, 10);
};

export const getConversionOpportunitiesData = async () => {
    // Get all organizations to identify potential leads
    const orgs = await organizations.findAll();

    const opportunities = await Promise.all(orgs.map(async (org: any) => {
        const [projectCount, drawingCount, userCount, admin] = await Promise.all([
            projects.count({ where: { organization_id: org.id } }),
            files.count({
                include: [{ model: projects, where: { organization_id: org.id } }],
            }),
            users.count({ where: { organization_id: org.id } }),
            users.findOne({
                where: { organization_id: org.id },
                order: [['is_primary', 'DESC'], ['createdAt', 'ASC']]
            })
        ]);

        const daysLeft = org.plan_end_date
            ? Math.ceil((new Date(org.plan_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        let activity = "Low";
        if (projectCount > 5 || drawingCount > 50) activity = "High";
        else if (projectCount >= 1 || drawingCount >= 1) activity = "Medium";

        return {
            name: org.name,
            email: admin?.email || "N/A",
            phone: admin?.phone_number || "N/A",
            projects: projectCount,
            drawings: drawingCount,
            teamSize: userCount,
            daysLeft: daysLeft > 0 ? daysLeft : 0,
            activity,
            plan: org.plan_name || "Free"
        };
    }));

    // Return top 10 by platform engagement
    return opportunities
        .sort((a: any, b: any) => (b.projects + b.drawings / 10) - (a.projects + a.drawings / 10))
        .slice(0, 10);
};
export const getOrganizationAnalyticsDetails = async (orgId: string | number) => {
    const [org, orgProjects, orgUsers, orgActivities] = await Promise.all([
        organizations.findByPk(orgId, {
            include: [{ model: plans, as: 'plan' }]
        }),
        projects.findAll({
            where: { organization_id: orgId }
        }),
        users.findAll({ where: { organization_id: orgId } }),
        activities.findAll({
            include: [{
                model: projects,
                as: 'project',
                where: { organization_id: orgId },
                required: true
            }, {
                model: users,
                as: 'user',
                attributes: ['name']
            }],
            order: [['createdAt', 'DESC']],
            limit: 20
        })
    ]);

    if (!org) return null;

    const admin = orgUsers.find((u: any) => u.role === 'admin') || orgUsers.find((u: any) => u.is_primary) || orgUsers[0];
    const projectStats = await Promise.all(orgProjects.map(async (project: any) => {
        const [taskCount, fileCount, projectRooms] = await Promise.all([
            snags.count({ where: { project_id: project.id } }),
            files.count({ where: { project_id: project.id } }),
            rooms.findAll({ where: { project_id: project.id }, attributes: ['id'] })
        ]);

        const roomIds = projectRooms.map((r: any) => r.id);
        console.log(roomIds)
        const messageCount = roomIds.length > 0
            ? await chat_messages.count({ where: { room_id: { [Op.in]: roomIds } } })
            : 0;

        return {
            id: project.id,
            name: project.name,
            tasks: taskCount,
            messages: messageCount,
            files: fileCount,
            status: project.status,
            createdAt: project.createdAt
        };
    }));

    return {
        organization: org,
        admin: {
            name: admin?.name || "N/A",
            email: admin?.email || "N/A",
            phone: (admin as any)?.phone_number || "N/A"
        },
        projects: projectStats,
        activities: orgActivities.map((act: any) => {
            const typeVerbs: Record<string, string> = {
                upload: "uploaded a file",
                upload_photo: "added a photo",
                comment: "commented",
                share: "shared a project",
                edit: "edited",
                delete: "deleted something"
            };
            const verb = typeVerbs[act.type] || act.type || "performed an action";
            return {
                icon: "Circle",
                text: `${act.user?.name || 'User'} ${verb} in ${act.project?.name || 'a project'}`,
                time: act.createdAt,
                type: act.type
            };
        })
    };
};

export const getAllUsersDetails = async () => {
    const allUsers = await users.findAll({
        where: {
            role: { [Op.ne]: 'superadmin' }
        },
        include: [{
            model: organizations,
            attributes: ['name']
        }],
        order: [['createdAt', 'DESC']]
    });

    return allUsers.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone_number || "N/A",
        orgName: user.organization?.name || "Independent",
        role: user.role,
        lastActive: user.updatedAt,
        createdAt: user.createdAt
    }));
};

