import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { users, organizations, project_members, projects } from "../models/index.ts";
import { Op } from "sequelize";
import redis from "../config/redis.ts";
import { sendEmail } from "../utils/email.ts";
import { normalizePhone, isValidPhone } from "../utils/sms.ts";
import { sendNotification } from "../utils/notificationUtils.ts";
import { getIO } from "../socket.ts";
import {
    checkMemberLimit,
    getSubscriptionAccessState,
} from "../utils/subscriptionAccess.ts";

export const adminLogin = async (req: Request, res: Response) => {
    try {
        const { email, phone, password } = req.body;

        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ error: "Invalid phone number. Please enter a 10-digit number." });
        }

        const normalizedPhone = phone ? normalizePhone(phone) : null;
        const normalizedEmail = email ? email.toLowerCase() : null;

        const user = await users.findOne({
            where: {
                [Op.or]: [
                    normalizedEmail ? { email: normalizedEmail } : null,
                    normalizedPhone ? { phone_number: normalizedPhone } : null
                ].filter(Boolean) as any[]
            }
        });

        if (!user || user.role !== "admin") {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { user_id: user.id, name: user.name, role: user.role, organization_id: user.organization_id },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "30d" }
        );


        // Optional FCM Token registration during login
        const { fcmToken } = req.body;
        if (fcmToken) {
            await users.update({ fcm_token: null }, { where: { fcm_token: fcmToken, id: { [Op.ne]: user.id } } });
            await user.update({ fcm_token: fcmToken });
        }

        res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number, role: user.role } });
    } catch (error) {
        console.error("Admin Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const projectLogin = async (req: Request, res: Response) => {
    try {
        const { email, phone, code } = req.body;

        if (!code) {
            return res.status(400).json({ error: "Project code is required" });
        }

        // Try to find project by contributor_code OR client_code
        const project = await projects.findOne({
            where: {
                [Op.or]: [
                    { contributor_code: code },
                    { client_code: code }
                ]
            }
        });

        if (!project) {
            return res.status(404).json({ error: "Invalid project code" });
        }

        if (!email && !phone) {
            return res.status(400).json({ error: "Email or Phone number is required" });
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ error: "Invalid phone number. Please enter a 10-digit number." });
        }

        const normalizedPhone = phone ? normalizePhone(phone) : null;
        const normalizedEmail = email ? email.toLowerCase() : null;

        // GLOBAL SEARCH: Look for user across all organizations to support multi-org/project access
        let user = await users.findOne({
            where: {
                [Op.or]: [
                    normalizedEmail ? { email: normalizedEmail } : null,
                    normalizedPhone ? { phone_number: normalizedPhone } : null
                ].filter(Boolean) as any[]
            }
        });
        
        if (user && user.organization_id && user.organization_id !== project.organization_id && user.role !== 'superadmin') {
            return res.status(403).json({ error: "You are already a member of another organization and cannot join projects in this one." });
        }

        const roleForCode = project.contributor_code === code ? 'contributor' : 'client';
        let isNewUser = false;

        if (!user) {
            if (roleForCode === "contributor" || roleForCode === "client") {
                const memberLimit = await checkMemberLimit(project.organization_id, roleForCode);
                if (!memberLimit.allowed) {
                    return res.status(memberLimit.status).json({
                        error: "Limit Reached",
                        message: memberLimit.message,
                        code: memberLimit.code,
                    });
                }
            }

            // Auto-create user because they have valid project code and no signup is required
            user = await users.create({
                organization_id: project.organization_id, // Default to this project's org
                name: "Pending",
                email: normalizedEmail,
                phone_number: normalizedPhone,
                role: roleForCode,
                email_verified: !!normalizedEmail,
                phone_verified: !!normalizedPhone,
                is_primary: false
            });
            isNewUser = true;
        }

        // Verify if user is already a member of this project with the SAME role
        const existingMembershipWithSameRole = await project_members.findOne({
            where: {
                project_id: project.id,
                user_id: user.id,
                role: roleForCode
            }
        });

        if (!existingMembershipWithSameRole) {
            // Auto-add them to the project since they possess a valid code for a role they don't have yet
            await project_members.create({
                project_id: project.id,
                user_id: user.id,
                role: roleForCode
            });

            // Notify all existing members (admin, contributors, clients) of this project
            try {
                const existingMembers = await project_members.findAll({
                    where: { project_id: project.id, user_id: { [Op.ne]: user.id } },
                    include: [{
                        model: users,
                        as: 'user',
                        attributes: ['id'],
                        where: { organization_id: project.organization_id }
                    }]
                });
                const joinerName = user.name && user.name !== 'Pending' ? user.name : (email || phone || 'Someone');
                const roleLabel = roleForCode === 'contributor' ? 'Contributor' : 'Client';
                for (const member of existingMembers) {
                    await sendNotification({
                        userId: member.user_id,
                        title: `New ${roleLabel} Joined`,
                        body: `${joinerName} joined the project as a ${roleLabel}.`,
                        type: 'member_joined',
                        data: { projectId: String(project.id) }
                    });
                }
                const orgAdmins = await users.findAll({
                    where: {
                        organization_id: project.organization_id,
                        role: 'admin',
                        id: { [Op.notIn]: [user.id, ...existingMembers.map((m: any) => m.user_id)] }
                    }
                });
                for (const admin of orgAdmins) {
                    await sendNotification({
                        userId: admin.id,
                        title: `New ${roleLabel} Joined`,
                        body: `${joinerName} joined the project as a ${roleLabel}.`,
                        type: 'member_joined',
                        data: { projectId: String(project.id) }
                    });
                }
                
                // Emit socket event to refresh project stats (counts) in real-time
                try {
                    getIO().to(`project-${project.id}`).emit('project-stats-updated', { projectId: String(project.id) });
                } catch (ioErr) {
                    console.error('Socket emit error (non-fatal):', ioErr);
                }
            } catch (notifErr) {
                console.error('Member join notification error (non-fatal):', notifErr);
            }
        }

        const token = jwt.sign(
            { 
                user_id: user.id, 
                name: user.name, 
                role: roleForCode, // Use the role associated with the login code
                organization_id: project.organization_id, // Active org context
                project_id: project.id 
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "30d" }
        );

        // Optional FCM Token registration during login
        const { fcmToken } = req.body;
        if (fcmToken) {
            await users.update({ fcm_token: null }, { where: { fcm_token: fcmToken, id: { [Op.ne]: user.id } } });
            await user.update({ fcm_token: fcmToken });
        }

        res.status(200).json({ 
            token, 
            user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number, role: roleForCode },
            isPendingName: user.name === "Pending" || !user.name || user.name.trim() === ""
        });
    } catch (error: any) {
        console.error("Project Login Error:", error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: "Email or phone number already in use by another account" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};

export const superadminLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await users.findOne({ where: { email: email.toLowerCase(), role: "superadmin" } });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { user_id: user.id, name: user.name, role: "superadmin" },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "24h" }
        );


        // Optional FCM Token registration during login
        const { fcmToken } = req.body;
        if (fcmToken) {
            await users.update({ fcm_token: null }, { where: { fcm_token: fcmToken, id: { [Op.ne]: user.id } } });
            await user.update({ fcm_token: fcmToken });
        }

        res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number, role: "superadmin" } });
    } catch (error) {
        console.error("Superadmin Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const me = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const dbUser = await users.findByPk(authUser.user_id, {
            attributes: ['id', 'name', 'email', 'phone_number', 'role', 'organization_id', 'profile_pic']
        });

        if (!dbUser) return res.status(404).json({ error: "User not found" });

        const activeOrgId = authUser.organization_id || dbUser.organization_id;
        const organization = activeOrgId ? await organizations.findByPk(activeOrgId) : null;
        const orgJson = organization ? (organization.toJSON() as any) : null;
        const access =
            organization && authUser.role !== "superadmin"
                ? getSubscriptionAccessState((organization as any).plan_end_date)
                : null;

        // Override the role from the database with the role from the JWT session
        // This ensures multi-role users see their current active role in the UI
        const userData = dbUser.toJSON();
        if (authUser.role) {
            userData.role = authUser.role;
        }

        res.status(200).json({
            user: userData,
            organization: orgJson
                ? {
                    ...orgJson,
                    subscription_locked: !!access?.isLocked,
                    subscription_in_grace_period: !!access?.isInGracePeriod,
                    subscription_plan_end_date: access?.planEndDate || null,
                    subscription_grace_end_date: access?.graceEndDate || null,
                    subscription_grace_days_remaining: access?.graceDaysRemaining ?? null,
                }
                : null,
            project_id: authUser.project_id || null
        });
    } catch (error) {
        console.error("Me Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const verifyInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: "Token is required" });

        const decoded: any = jwt.verify(token as string, process.env.JWT_SECRET || "default_secret");
        res.status(200).json({ email: decoded.email, role: decoded.role || 'admin' });
    } catch (error) {
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const completeOnboarding = async (req: Request, res: Response) => {
    try {
        const { token, name, password } = req.body;
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "default_secret");

        const updateData: any = {
            name,
            email_verified: true
        };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await users.update(updateData, { where: { id: decoded.user_id } });

        res.status(200).json({ message: "Account setup complete" });
    } catch (error) {
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const verifyOnboardingToken = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: "Token is required" });

        const decoded: any = jwt.verify(token as string, process.env.JWT_SECRET || "default_secret");
        if (decoded.type !== "public_onboarding") throw new Error("Invalid token type");

        res.status(200).json({ role: decoded.role, organization_id: decoded.organization_id });
    } catch (error) {
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const completePublicSignup = async (req: Request, res: Response) => {
    try {
        const { token, name, email, phone, project_code } = req.body;
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "default_secret");

        if (decoded.type !== "public_onboarding") throw new Error("Invalid token type");

        if (!email && !phone) return res.status(400).json({ error: "Email or Phone is required" });
        if (!project_code) return res.status(400).json({ error: "Project code is required" });

        const project = await projects.findOne({
            where: {
                organization_id: decoded.organization_id,
                [Op.or]: [
                    { contributor_code: project_code },
                    { client_code: project_code }
                ]
            }
        });

        if (!project) return res.status(404).json({ error: "Invalid project code" });

        const normalizedEmail = email?.toLowerCase() || null;
        const normalizedPhone = phone ? normalizePhone(phone) : null;

        // GLOBAL SEARCH: Look for existing user to support multi-org/project enrollment
        let user = await users.findOne({
            where: {
                [Op.or]: [
                    normalizedEmail ? { email: normalizedEmail } : null,
                    normalizedPhone ? { phone_number: normalizedPhone } : null
                ].filter(Boolean) as any[]
            }
        });

        if (user && user.organization_id && user.organization_id !== decoded.organization_id && user.role !== 'superadmin') {
            return res.status(403).json({ error: "You are already a member of another organization and cannot join projects in this one." });
        }

        if (!user) {
            if (decoded.role === "contributor" || decoded.role === "client") {
                const memberLimit = await checkMemberLimit(decoded.organization_id, decoded.role);
                if (!memberLimit.allowed) {
                    return res.status(memberLimit.status).json({
                        error: "Limit Reached",
                        message: memberLimit.message,
                        code: memberLimit.code,
                    });
                }
            }

            // Create user only if they don't exist globally
            user = await users.create({
                organization_id: decoded.organization_id,
                name,
                email: normalizedEmail,
                phone_number: normalizedPhone,
                role: decoded.role,
                email_verified: !!email,
                phone_verified: !!phone,
                is_primary: false
            });
        }

        // Verify if already a member with the EXACT same role
        const existingMembershipWithSameRole = await project_members.findOne({
            where: { project_id: project.id, user_id: user.id, role: decoded.role }
        });

        if (!existingMembershipWithSameRole) {
            // Add to project with the new role
            await project_members.create({
                project_id: project.id,
                user_id: user.id,
                role: decoded.role
            });
        }

        // Notify all existing project members
        try {
            const existingMembers = await project_members.findAll({
                where: { project_id: project.id, user_id: { [Op.ne]: user.id } },
                include: [{
                    model: users,
                    as: 'user',
                    attributes: ['id'],
                    where: { organization_id: project.organization_id } // Boundary check
                }]
            });
            const roleLabel = decoded.role === 'contributor' ? 'Contributor' : 'Client';
            const joinerName = user.name && user.name !== 'Pending' ? user.name : (name || email || phone || 'Someone');
            for (const member of existingMembers) {
                await sendNotification({
                    userId: member.user_id,
                    title: `New ${roleLabel} Joined`,
                    body: `${joinerName} joined the project as a ${roleLabel}.`,
                    type: 'member_joined',
                    data: { projectId: String(project.id) }
                });
            }
            const orgAdmins = await users.findAll({
                where: {
                    organization_id: decoded.organization_id,
                    role: 'admin',
                    id: { [Op.notIn]: [user.id, ...existingMembers.map((m: any) => m.user_id)] }
                }
            });
            for (const admin of orgAdmins) {
                await sendNotification({
                    userId: admin.id,
                    title: `New ${roleLabel} Joined`,
                    body: `${joinerName} joined the project as a ${roleLabel}.`,
                    type: 'member_joined',
                    data: { projectId: String(project.id) }
                });
            }
            
            // Emit socket event to refresh project stats (counts) in real-time
            try {
                getIO().to(`project-${project.id}`).emit('project-stats-updated', { projectId: String(project.id) });
            } catch (ioErr) {
                console.error('Socket emit error (non-fatal):', ioErr);
            }
        } catch (notifErr) {
            console.error('Member join notification error (non-fatal):', notifErr);
        }

        res.status(201).json({ message: "Signup complete" });
    } catch (error) {
        console.error("Public Signup Error:", error);
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const forgotPasswordRequestOtp = async (req: Request, res: Response) => {
    try {
        const { email, role } = req.body;
        const user = await users.findOne({ where: { email: email.toLowerCase(), role } });

        if (!user) return res.status(404).json({ error: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);

        await redis.set(`otp:forgot:${email}`, otpHash, "EX", 600);
        await sendEmail(email, "Password Reset OTP", `Your OTP for password reset is: ${otp}`);

        res.status(200).json({ message: "OTP sent to email" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const forgotPasswordVerifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const normalizedEmail = email.toLowerCase();
        const savedOtpHash = await redis.get(`otp:forgot:${normalizedEmail}`);

        if (!savedOtpHash || !(await bcrypt.compare(otp, savedOtpHash))) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        const resetToken = jwt.sign({ email: normalizedEmail }, process.env.JWT_SECRET || "default_secret", { expiresIn: "15m" });
        await redis.del(`otp:forgot:${normalizedEmail}`);

        res.status(200).json({ resetToken });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { resetToken, newPassword } = req.body;
        const decoded: any = jwt.verify(resetToken, process.env.JWT_SECRET || "default_secret");

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await users.update({ password: passwordHash }, { where: { email: decoded.email } });

        res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        res.status(400).json({ error: "Invalid or expired reset token" });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { currentPassword, newPassword } = req.body;

        const user = await users.findByPk(authUser.user_id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect current password" });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await users.update({ password: passwordHash }, { where: { id: user.id } });

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};
export const getMyMemberships = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const dbUser = await users.findByPk(authUser.user_id, { attributes: ['id', 'role', 'organization_id'] });
        
        const memberships = await project_members.findAll({
            where: { user_id: authUser.user_id },
            include: [{ 
                model: projects, 
                attributes: ['id', 'name', 'organization_id'],
                include: [{ model: organizations, attributes: ['name'] }]
            }]
        });

        const results = memberships.map((m: any) => m.toJSON ? m.toJSON() : m);

        // If the user's primary role is admin or superadmin, they should be able to switch back to that role 
        // for any project they are a member of (or currently viewing), even if not explicitly in project_members with that role.
        if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'superadmin')) {
            const primaryRole = dbUser.role;

            // 1. Ensure primary role is available for all existing memberships
            results.forEach((m: any) => {
                const hasPrimary = results.some((sm: any) => sm.project_id === m.project_id && sm.role === primaryRole);
                if (!hasPrimary) {
                    results.push({
                        project_id: m.project_id,
                        user_id: dbUser.id,
                        role: primaryRole,
                        project: m.project
                    });
                }
            });

            // 2. Also ensure it's available for the current active project if not already in results
            const currentProjectId = authUser.project_id;
            if (currentProjectId) {
                const alreadyInResults = results.some((m: any) => Number(m.project_id) === Number(currentProjectId) && m.role === primaryRole);
                if (!alreadyInResults) {
                    const project = await projects.findByPk(currentProjectId, {
                        include: [{ model: organizations, as: 'organization', attributes: ['name'] }]
                    });
                    // For admins, check org match. Superadmins can switch anywhere.
                    if (project && (primaryRole === 'superadmin' || project.organization_id === dbUser.organization_id)) {
                        results.push({
                            project_id: project.id,
                            user_id: dbUser.id,
                            role: primaryRole,
                            project: project.toJSON()
                        });
                    }
                }
            }
        }

        res.status(200).json({ memberships: results });
    } catch (error) {
        console.error("Get My Memberships Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const switchContext = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { project_id, role } = req.body;

        if (!project_id || !role) {
            return res.status(400).json({ error: "Project ID and role are required" });
        }

        const user = await users.findByPk(authUser.user_id);
        const project = await projects.findByPk(project_id);

        if (!user || !project) {
            return res.status(404).json({ error: "User or project not found" });
        }

        // PERMISSION CHECK: 
        // 1. Is user a Superadmin? (Can switch to any role for any project)
        // 2. Is user an Admin of the organization? (Can switch to 'admin' role for any project in their org)
        const isPrimaryRoleSwitch = (
            (user.role === 'admin' && role === 'admin' && project.organization_id === user.organization_id) ||
            (user.role === 'superadmin')
        );

        let membership = null;
        if (!isPrimaryRoleSwitch) {
            // Only query project_members if it's NOT a primary role switch or superadmin switch
            // This avoids invalid ENUM input errors for 'admin' role which isn't in the enum.
            membership = await project_members.findOne({
                where: { user_id: authUser.user_id, project_id, role }
            });
        }

        if (!membership && !isPrimaryRoleSwitch) {
            return res.status(403).json({ error: "No such membership found" });
        }

        const token = jwt.sign(
            {
                user_id: user.id,
                name: user.name,
                role: role,
                organization_id: project.organization_id,
                project_id: project.id
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "30d" }
        );

        res.status(200).json({ 
            token, 
            user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number, role: role }
        });
    } catch (error) {
        console.error("Switch Context Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
