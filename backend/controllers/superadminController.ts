import type { Request, Response } from "express";
import { organizations, projects, folders, users } from "../models/index.ts";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/email.ts";
import { sendNotification } from "../utils/notificationUtils.ts";

export const getOrgOverview = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        // Ensure this endpoint is exclusively for SuperAdmins
        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const orgId = authUser.organization_id;

        // Fetch All Users mapped to this Organization
        const orgUsers = await users.findAll({
            where: { organization_id: orgId },
            attributes: ['id', 'name', 'email', 'role', 'is_primary']
        });

        // Fetch Organization metadata
        const orgDetails = await organizations.findByPk(orgId);

        // Fetch all projects for this Orgainzation, including their nested folders
        const allProjects = await projects.findAll({
            where: { organization_id: orgId },
            include: [{
                model: folders,
                as: "folders"
            }]
        });

        res.status(200).json({
            organization: orgDetails,
            users: orgUsers,
            projects: allProjects
        });

    } catch (error) {
        console.error("SuperAdmin Overview Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getSuperAdmins = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        // Fetch all SuperAdmins
        const allSuperAdmins = await users.findAll({
            where: { role: 'superadmin' },
            attributes: ['id', 'name', 'email', 'role', 'is_primary', 'createdAt', 'email_verified']
        });

        res.status(200).json({ teams: allSuperAdmins });
    } catch (error) {
        console.error("Get SuperAdmins Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getOrganizations = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const accounts = await analyticsService.getDetailedAccountsList();
        res.status(200).json({ organizations: accounts });
    } catch (error) {
        console.error("Get Organizations Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const inviteSuperAdmin = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { email } = req.body;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        // Check if user already exists
        let user = await users.findOne({ where: { email } });

        if (user) {
            // If they already exist, we can promote them to superadmin
            // if (user.role === 'superadmin') {
            //     return res.status(400).json({ error: "User is already a SuperAdmin" });
            // } else {
                return res.status(400).json({ error: `User is already exist as ${user.role}, use different email` });
            // }
            // Promotion logic: Update role to superadmin
            // await user.update({ role: 'superadmin', organization_id: null });

        } else {
            // Create pending user
            user = await users.create({
                name: "New User", // Placeholder
                email,
                password: "", // No password yet
                role: "superadmin",
                is_primary: false,
                email_verified: false,
                organization_id: null
            });
        }

        // Generate invitation token
        const token = jwt.sign(
            { user_id: user.id, email: user.email },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "24h" }
        );

        // Send invitation email
        const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/superadmin-onboarding?token=${token}`;

        await sendEmail(
            email,
            "Invitation to join APEXISpro™ as SuperAdmin",
            `<div style="font-family: Arial, Helvetica, sans-serif; color: #14213d;">
                <div style="font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 20px;">
                    APEXIS<span style="font-size: 16px;">PRO™</span>
                </div>
                <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Welcome to APEXIS<span style="font-size: 14px;">PRO™</span></h1>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 12px;">You have been invited to join the APEXIS<span style="font-size: 13px;">PRO™</span> team as a SuperAdmin.</p>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Please click the link below to securely login to the admin portal:</p>
                <a href="${inviteUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Login to Admin Portal</a>
             </div>`,
            true
        );

        res.status(201).json({ message: "Invitation sent successfully", user: user });
    } catch (error) {
        console.error("Invite SuperAdmin Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteSuperAdmin = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const userToDelete = await users.findByPk(id);
        if (!userToDelete) {
            return res.status(404).json({ error: "User not found" });
        }

        if (userToDelete.is_primary) {
            return res.status(400).json({ error: "Cannot delete the primary SuperAdmin" });
        }

        if (userToDelete.id === authUser.user_id) {
            return res.status(400).json({ error: "You cannot delete yourself" });
        }

        await userToDelete.destroy();

        res.status(200).json({ message: "SuperAdmin deleted successfully" });
    } catch (error) {
        console.error("Delete SuperAdmin Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// --- NEW METRICS CONTROLLERS ---
import * as analyticsService from "../services/analyticsService.ts";

export const getDashboardOverview = async (req: Request, res: Response) => {
    try {
        const stats = await analyticsService.getDashboardOverviewStats();
        const growth = await analyticsService.getPlatformGrowthData();
        const activity = await analyticsService.getProjectActivityData();
        const comms = await analyticsService.getCommunicationStats();
        const topProjects = await analyticsService.getTopActiveProjects();
        const feed = await analyticsService.getGlobalActivityFeed();
        const insightsData = await analyticsService.getPlatformInsights();
        const revenue = await analyticsService.getRevenueAnalytics();
        const revenueTrend = await analyticsService.getRevenueGrowthData();
        const alerts = await analyticsService.getPlatformAlerts();
        const companyUsage = await analyticsService.getCompanyUsageData();

        res.status(200).json({ stats, growth, activity, comms, topProjects, feed, revenue, revenueTrend, alerts, companyUsage, ...insightsData });
    } catch (error) {
        console.error("getDashboardOverview Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getRevenueMetrics = async (req: Request, res: Response) => {
    try {
        const data = await analyticsService.getRevenueAnalytics();
        const churnData = await analyticsService.getChurnAndRetentionMetrics();
        const revenueTrend = await analyticsService.getRevenueGrowthData();
        const feedbackData = await analyticsService.getFeedbackData();

        res.status(200).json({
            ...data,
            ...churnData,
            revenueTrend,
            feedbackData
        });
    } catch (error) {
        console.error("getRevenueMetrics Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getFreemiumLeadList = async (req: Request, res: Response) => {
    try {
        const leads = await analyticsService.getFreemiumLeads();
        res.status(200).json({ leads });
    } catch (error) {
        console.error("getFreemiumLeadList Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getGrowthAnalytics = async (req: Request, res: Response) => {
    try {
        const data = await analyticsService.getSaasGrowthAnalytics();
        const revenueGrowth = await analyticsService.getRevenueGrowthData();
        const productUsageData = await analyticsService.getProductUsageData();
        const userGrowthMonthly = await analyticsService.getUserGrowthData();
        const companyActivity = await analyticsService.getCompanyActivityData();
        const conversionOpportunities = await analyticsService.getConversionOpportunitiesData();

        // Calculate SaaS Performance KPIs (Default to All Time)
        const currentStats = (data as any).allTime;
        const { totalUsers, paidSubscribers, freemiumUsers, conversionRate } = currentStats;
        const saasPerformance = [
            { label: "Free → Paid Rate", value: conversionRate.total || "0%", color: "bg-success" },
            { label: "Trial Completion Rate", value: totalUsers.total > 0 ? ((freemiumUsers.total / totalUsers.total) * 100).toFixed(1) + "%" : "0%", color: "bg-primary" },
            { label: "Churn Rate", value: (data as any).churnRate || "0%", color: "bg-destructive" }
        ];

        res.status(200).json({
            ...data,
            revenueGrowth,
            productUsageData,
            userGrowthMonthly,
            companyActivity,
            conversionOpportunities,
            saasPerformance
        });
    } catch (error) {
        console.error("getGrowthAnalytics Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getOrganizationDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const details = await analyticsService.getOrganizationAnalyticsDetails(id as string);

        if (!details) {
            return res.status(404).json({ error: "Organization not found" });
        }

        res.status(200).json(details);
    } catch (error) {
        console.error("getOrganizationDetails Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getUsersList = async (req: Request, res: Response) => {
    try {
        const users = await analyticsService.getAllUsersDetails();
        res.status(200).json(users);
    } catch (error) {
        console.error("getUsersList Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const sendBroadcastNotification = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { title, description } = req.body;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        if (!title || !description) {
            return res.status(400).json({ error: "Title and description are required" });
        }

        // Fetch all active users
        const allUsers = await users.findAll({
            attributes: ['id']
        });

        if (allUsers.length === 0) {
            return res.status(200).json({ message: "No users found to notify" });
        }

        // Send notification to each user
        // Note: For large numbers of users, this should be a background job
        const notificationPromises = allUsers.map((user: any) =>
            sendNotification({
                userId: user.id,
                title,
                body: description,
                type: 'broadcast',
                data: {
                    sentBy: authUser.user_id,
                    isBroadcast: true
                }
            })
        );

        await Promise.all(notificationPromises);

        res.status(200).json({
            message: "Broadcast sent successfully",
            count: allUsers.length
        });

    } catch (error) {
        console.error("Send Broadcast Notification Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
