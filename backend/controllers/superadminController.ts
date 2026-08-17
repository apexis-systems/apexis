import type { Request, Response } from "express";
import { organizations, projects, folders, users, plans, transactions } from "../models/index.ts";
import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { saveSystemConfig, getCachedVersion } from "./systemController.ts";
import { sendEmail } from "../utils/email.ts";
import { sendNotification } from "../utils/notificationUtils.ts";
import { generateInvoice } from "../services/invoiceService.ts";
import { getIO } from "../socket.ts";

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

export const getFilteredActivities = async (req: Request, res: Response) => {
    try {
        const { companyId, type, dateRange, startDate, endDate, limit } = req.query;
        const feed = await analyticsService.getFilteredActivityFeed({
            companyId: companyId as string,
            type: type as string,
            dateRange: dateRange as string,
            startDate: startDate as string,
            endDate: endDate as string,
            limit: limit ? Number(limit) : 25,
        });
        res.status(200).json({ feed });
    } catch (error) {
        console.error("getFilteredActivities Error:", error);
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

export const getAllLeadList = async (req: Request, res: Response) => {
    try {
        const leads = await analyticsService.getAllLeads();
        res.status(200).json({ leads });
    } catch (error) {
        console.error("getAllLeadList Error:", error);
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

export const extendOrganizationTrials = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const { organizationIds, days } = req.body;

        if (!Array.isArray(organizationIds) || organizationIds.length === 0) {
            return res.status(400).json({ error: "organizationIds must be a non-empty array" });
        }

        const extendByDays = Number(days);
        if (!Number.isFinite(extendByDays) || extendByDays <= 0) {
            return res.status(400).json({ error: "days must be a positive number" });
        }

        const orgs = await organizations.findAll({ where: { id: organizationIds } });

        if (orgs.length === 0) {
            return res.status(404).json({ error: "No matching organizations found" });
        }

        const now = new Date();
        await Promise.all(orgs.map((org: any) => {
            const currentEnd = org.plan_end_date ? new Date(org.plan_end_date) : now;
            const base = currentEnd > now ? currentEnd : now;
            const newEndDate = new Date(base.getTime() + extendByDays * 24 * 60 * 60 * 1000);
            return org.update({ plan_end_date: newEndDate });
        }));

        res.status(200).json({
            message: `Extended trial by ${extendByDays} day(s) for ${orgs.length} organization(s)`,
            updated: orgs.map((org: any) => ({ id: org.id, plan_end_date: org.plan_end_date }))
        });
    } catch (error) {
        console.error("Extend Organization Trials Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateSystemConfig = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const { minAppVersion } = req.body;

        if (!minAppVersion || typeof minAppVersion !== 'string') {
            return res.status(400).json({ error: "A valid minAppVersion string is required" });
        }

        await saveSystemConfig(minAppVersion);

        // Broadcast push notification to all users about the new version
        try {
            const allUsers = await users.findAll({ attributes: ["id"] });
            if (allUsers && allUsers.length > 0) {
                const notificationPromises = allUsers.map((user: any) =>
                    sendNotification({
                        userId: user.id,
                        title: "New Version is available",
                        body: `Version ${minAppVersion} is now available. Please update your app.`,
                        type: "broadcast",
                        data: {
                            sentBy: authUser.user_id,
                            isBroadcast: true,
                            minAppVersion
                        }
                    })
                );
                // Send notifications in the background so that the API response is not blocked/delayed
                Promise.all(notificationPromises).catch(err => {
                    console.error("Error broadcasting new version notifications:", err);
                });
            }
        } catch (notifError) {
            console.error("Failed to prepare new version broadcast notifications:", notifError);
        }

        res.status(200).json({
            success: true,
            message: "App version configuration updated successfully",
            data: {
                minAppVersion: getCachedVersion()
            }
        });
    } catch (error: any) {
        console.error("updateSystemConfig Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

export const createCustomPlanOffer = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const { organizationId, seats, storageGb, cycle, amount, notes } = req.body;

        const orgIdNum = Number(organizationId);
        const seatsNum = Number(seats);
        const storageNum = Number(storageGb);
        const amountNum = Number(amount);
        const planCycle = cycle === "annual" ? "annual" : "monthly";

        if (!orgIdNum || !Number.isFinite(seatsNum) || seatsNum < 1 || !Number.isFinite(storageNum) || storageNum < 1 || !Number.isFinite(amountNum) || amountNum < 0) {
            return res.status(400).json({ error: "Invalid parameters. Please provide valid organizationId, seats, storageGb, and amount." });
        }

        const org = await organizations.findByPk(orgIdNum);
        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }

        const durationDays = planCycle === "annual" ? 365 : 30;
        const perSeatPrice = planCycle === "annual" ? (amountNum / seatsNum / 12) : (amountNum / seatsNum);

        // Create new custom plan record in plans table
        const customPlan = await plans.create({
            name: `Custom Plan (${org.name})`,
            price: amountNum,
            price_per_seat_monthly: Number(perSeatPrice.toFixed(2)),
            price_per_seat_annually: Number(perSeatPrice.toFixed(2)),
            storage_limit_mb: storageNum * 1024,
            duration_days: durationDays,
            project_limit: 9999,
            contributor_limit: seatsNum,
            client_limit: 9999,
            max_snags: 9999,
            max_rfis: 9999,
            can_export_reports: true,
            can_share_media: true,
            can_export_handover: true,
            is_active: true,
            is_custom: true,
            organization_id: org.id,
            subscription_cycle: planCycle,
            custom_notes: notes || null
        });

        // Set pending_custom_plan_id on organization
        await org.update({ pending_custom_plan_id: customPlan.id });

        // Find primary admin user for notification
        const adminUser = await users.findOne({
            where: { organization_id: org.id, role: 'admin' },
            order: [['is_primary', 'DESC'], ['createdAt', 'ASC']]
        });

        if (adminUser) {
            await sendNotification({
                userId: adminUser.id,
                title: "🎉 Special Custom Plan Offer",
                body: `Superadmin has generated a custom plan offer of ${seatsNum} seats and ${storageNum} GB storage for your organization. Tap to view and accept.`,
                type: "custom_plan_offer",
                data: {
                    organization_id: org.id,
                    pending_custom_plan_id: customPlan.id,
                    seats: seatsNum,
                    storageGb: storageNum,
                    cycle: planCycle,
                    price: amountNum,
                    custom_notes: notes || ""
                }
            }).catch(err => console.error("Error sending custom plan notification:", err));
        }

        res.status(201).json({
            success: true,
            message: `Successfully created custom plan offer for ${org.name}`,
            plan: customPlan
        });

    } catch (error: any) {
        console.error("createCustomPlanOffer Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

const formatInvoicePrefix = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `APX-${dd}-${mm}-`;
};

const generateInvoiceNumber = async (date: Date = new Date()) => {
    const prefix = formatInvoicePrefix(date);
    const latest = await transactions.findOne({
        where: { invoice_number: { [Op.like]: `${prefix}%` } },
        attributes: ["invoice_number"],
        order: [["invoice_number", "DESC"]],
    });

    const latestInvoice = (latest as any)?.invoice_number as string | undefined;
    const latestSeq = latestInvoice
        ? Number(latestInvoice.split("-").pop() || "0")
        : 0;
    const nextSeq = Number.isFinite(latestSeq) ? latestSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
};

export const getPendingCustomPlanForOrg = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const { organizationId } = req.params;
        const orgIdNum = Number(organizationId);

        if (!orgIdNum) {
            return res.status(400).json({ error: "Invalid organizationId" });
        }

        const org = await organizations.findByPk(orgIdNum, {
            include: [{ model: plans, as: "pendingCustomPlan" }]
        });

        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }

        const plan = (org as any)?.pendingCustomPlan;
        if (!plan) {
            return res.status(404).json({ error: "No pending custom plan found for this organization" });
        }

        res.status(200).json({
            organization: {
                id: org.id,
                name: org.name,
            },
            plan
        });
    } catch (error: any) {
        console.error("getPendingCustomPlanForOrg Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

export const activateCustomPlan = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const { organizationId } = req.body;
        const orgIdNum = Number(organizationId);

        if (!orgIdNum) {
            return res.status(400).json({ error: "Invalid organizationId" });
        }

        const org = await organizations.findByPk(orgIdNum, {
            include: [{ model: plans, as: "pendingCustomPlan" }]
        });

        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }

        const customPlan = (org as any)?.pendingCustomPlan;
        if (!customPlan) {
            return res.status(400).json({ error: "No pending custom plan found to activate for this organization." });
        }

        // Find primary admin user
        let adminUser = await users.findOne({
            where: { organization_id: org.id, role: 'admin', is_primary: true }
        });
        if (!adminUser) {
            adminUser = await users.findOne({
                where: { organization_id: org.id },
                order: [['createdAt', 'ASC']]
            });
        }

        const now = new Date();
        const durationDays = customPlan.duration_days || (customPlan.subscription_cycle === 'annual' ? 365 : 30);
        const planEndDate = new Date(now.getTime() + durationDays * 24 * 3600 * 1000);

        // Update organization plan details
        await org.update({
            plan_id: customPlan.id,
            plan_name: "Custom Enterprise",
            plan_price: customPlan.price,
            seats_purchased: customPlan.contributor_limit,
            storage_limit_mb: customPlan.storage_limit_mb,
            subscription_cycle: customPlan.subscription_cycle || "monthly",
            plan_start_date: now,
            plan_end_date: planEndDate,
            pending_custom_plan_id: null,
            auto_pay_enabled: false
        });

        // Generate Invoice Number
        const invoiceNumber = await generateInvoiceNumber(now);

        // Create transaction record with is_superadmin_activated = true (Skips GST on invoice)
        const transaction = await transactions.create({
            organization_id: org.id,
            user_id: adminUser?.id || authUser.user_id,
            subscription_tier: "Custom Enterprise",
            subscription_cycle: customPlan.subscription_cycle || "monthly",
            seats_purchased: customPlan.contributor_limit,
            price_per_seat: customPlan.price_per_seat_monthly || 0,
            payment_amount: customPlan.price,
            payment_order_id: `SA-DIRECT-${Date.now()}`,
            payment_id: `DIRECT-PAYMENT-BY-SUPERADMIN`,
            payment_status: "success",
            invoice_number: invoiceNumber,
            is_superadmin_activated: true
        });

        // Generate PDF Invoice without GST (is_superadmin_activated is true)
        let invoicePdfBuffer: Buffer | null = null;
        try {
            invoicePdfBuffer = await generateInvoice(transaction.id);
        } catch (pdfErr) {
            console.error("Error generating invoice PDF:", pdfErr);
        }

        // Send Email with Invoice Attachment to User
        if (adminUser && adminUser.email) {
            const cycleText = customPlan.subscription_cycle === "annual" ? "Annual" : "Monthly";
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e7e5e4; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #f97415; margin-bottom: 16px;">
                        APEXIS<span style="font-size: 16px; color: #78716c;">PRO™</span>
                    </div>
                    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">Your Custom Enterprise Plan is Now Active!</h2>
                    <p style="font-size: 14px; line-height: 1.6; color: #44403c;">Hello <strong>${adminUser.name || 'Valued Customer'}</strong>,</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #44403c;">
                        We have verified your direct payment and your <strong>Custom Enterprise Plan</strong> has been activated for <strong>${org.name}</strong>.
                    </p>
                    
                    <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Plan Summary</h3>
                        <p style="margin: 6px 0; font-size: 13px;"><strong>Organization:</strong> ${org.name}</p>
                        <p style="margin: 6px 0; font-size: 13px;"><strong>Seats:</strong> ${customPlan.contributor_limit} contributor seats</p>
                        <p style="margin: 6px 0; font-size: 13px;"><strong>Storage:</strong> ${Math.round((customPlan.storage_limit_mb || 0) / 1024)} GB</p>
                        <p style="margin: 6px 0; font-size: 13px;"><strong>Billing Cycle:</strong> ${cycleText}</p>
                        <p style="margin: 6px 0; font-size: 13px;"><strong>Total Amount:</strong> ₹${Number(customPlan.price).toLocaleString('en-IN')}</p>
                        <p style="margin: 6px 0; font-size: 13px;"><strong>Valid Until:</strong> ${planEndDate.toLocaleDateString('en-IN')}</p>
                    </div>

                    <p style="font-size: 14px; line-height: 1.6; color: #44403c;">
                        Please find your official payment invoice attached to this email. You can also view and download your invoice anytime from your account settings.
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #44403c; margin-top: 24px;">
                        Thank you for partnering with APEXISpro™.<br>
                        <strong>The APEXIS Team</strong>
                    </p>
                </div>
            `;

            try {
                await sendEmail(
                    adminUser.email,
                    `Invoice #${invoiceNumber} - Custom Enterprise Plan Activated | APEXISpro™`,
                    emailHtml,
                    {
                        isHtml: true,
                        attachments: invoicePdfBuffer ? [
                            {
                                filename: `Invoice_${invoiceNumber}.pdf`,
                                content: invoicePdfBuffer,
                                contentType: 'application/pdf',
                            }
                        ] : []
                    }
                );
            } catch (emailErr) {
                console.error("Error sending invoice email:", emailErr);
            }

            // In-app notification
            try {
                await sendNotification({
                    userId: adminUser.id,
                    title: "✅ Plan Activated",
                    body: `Your Custom Enterprise Plan (${customPlan.contributor_limit} seats, ${Math.round((customPlan.storage_limit_mb || 0) / 1024)} GB) has been activated. Invoice #${invoiceNumber} sent to your email.`,
                    type: "plan_activated",
                    data: {
                        organization_id: org.id,
                        transaction_id: transaction.id,
                        invoice_number: invoiceNumber
                    }
                });
            } catch (notifErr) {
                console.error("Error sending in-app notification:", notifErr);
            }
        }

        // Live Real-time Sync via Socket
        try {
            const orgUsers = await users.findAll({
                where: { organization_id: org.id },
                attributes: ["id"],
            });
            const io = getIO();
            for (const u of orgUsers as any[]) {
                io.to(`user-${String(u.id)}`).emit("subscription-updated", {
                    organization_id: org.id,
                    plan_name: "Custom Enterprise",
                    plan_cycle: customPlan.subscription_cycle || "monthly",
                    subscription_end_date: planEndDate,
                    updated_at: new Date().toISOString(),
                });
            }
        } catch (socketError) {
            console.error("Failed to emit socket event:", socketError);
        }

        res.status(200).json({
            success: true,
            message: `Custom plan successfully activated for ${org.name}. Invoice #${invoiceNumber} generated and emailed.`,
            transactionId: transaction.id,
            invoiceNumber
        });

    } catch (error: any) {
        console.error("activateCustomPlan Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};


