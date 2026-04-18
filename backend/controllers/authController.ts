import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { users, organizations, project_members, projects } from "../models/index.ts";
import { Op } from "sequelize";
import redis from "../config/redis.ts";
import { sendEmail } from "../utils/email.ts";
import { buildForgotPasswordOtpEmail } from "../utils/emailTemplates.ts";
import { normalizePhone, isValidPhone, sendOTP, isIndianPhone } from "../utils/sms.ts";
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

        // Reuse the existing user record so members can join multiple projects across organizations.
        let user = await users.findOne({
            where: {
                [Op.or]: [
                    normalizedEmail ? { email: normalizedEmail } : null,
                    normalizedPhone ? { phone_number: normalizedPhone } : null
                ].filter(Boolean) as any[]
            }
        });

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

        if (user && user.role === 'admin' && user.organization_id === project.organization_id) {
            return res.status(400).json({ error: "You are an Admin of this organization and already have access to all projects." });
        }

        // Verify if user is already a member of this project with ANY role
        const existingMembership = await project_members.findOne({
            where: {
                project_id: project.id,
                user_id: user.id
            }
        });

        if (existingMembership) {
            if (existingMembership.role !== roleForCode) {
                return res.status(400).json({ 
                    error: `You are already a member of this project as a ${existingMembership.role}. You cannot join with a different role.` 
                });
            }
            // If they are already a member with the SAME role, we proceed to login (token generation)
        } else {
            // Auto-add them to the project since they possess a valid code and are not yet a member
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
                        attributes: ['id']
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
                        data: { projectId: String(project.id), type: 'overview' }
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
                        data: { projectId: String(project.id), type: 'overview' }
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

        // Reuse the existing user record so members can join multiple projects across organizations.
        let user = await users.findOne({
            where: {
                [Op.or]: [
                    normalizedEmail ? { email: normalizedEmail } : null,
                    normalizedPhone ? { phone_number: normalizedPhone } : null
                ].filter(Boolean) as any[]
            }
        });

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

        if (user && user.role === 'admin' && user.organization_id === project.organization_id) {
            return res.status(400).json({ error: "You are an Admin of this organization. You already have full access." });
        }

        // Verify if already a member of this project (any role)
        const existingMembership = await project_members.findOne({
            where: { project_id: project.id, user_id: user.id }
        });

        if (existingMembership) {
            if (existingMembership.role !== decoded.role) {
                return res.status(400).json({ 
                    error: `You are already a member of this project as a ${existingMembership.role}. You cannot join as a ${decoded.role}.` 
                });
            }
            // Already a member with the same role, proceed to success (no duplicate needed)
        } else {
            // Add to project with the new role
            await project_members.create({
                project_id: project.id,
                user_id: user.id,
                role: decoded.role
            });

            // Notify only the relevant project members and admins in the same organization.
            try {
                const existingMembers = await project_members.findAll({
                    where: { project_id: project.id, user_id: { [Op.ne]: user.id } },
                    include: [{
                        model: users,
                        as: 'user',
                        attributes: ['id']
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
                        data: { projectId: String(project.id), type: 'overview' }
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
                        data: { projectId: String(project.id), type: 'overview' }
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

        res.status(201).json({ message: "Signup complete" });
    } catch (error) {
        console.error("Public Signup Error:", error);
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const forgotPasswordRequestOtp = async (req: Request, res: Response) => {
    try {
        const { email, phone, role } = req.body;
        
        const normalizedEmail = email ? email.toLowerCase() : null;
        const normalizedPhone = phone ? normalizePhone(phone) : null;

        if (!normalizedEmail && !normalizedPhone) {
            return res.status(400).json({ error: "Email or Phone number is required" });
        }

        const user = await users.findOne({
            where: {
                [Op.or]: [
                    normalizedEmail ? { email: normalizedEmail } : null,
                    normalizedPhone ? { phone_number: normalizedPhone } : null
                ].filter(Boolean) as any[],
                role
            }
        });

        if (!user) return res.status(404).json({ error: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);

        const identifier = normalizedEmail || normalizedPhone;
        
        if (normalizedPhone && !normalizedEmail && !isIndianPhone(normalizedPhone)) {
            return res.status(400).json({ error: "Phone OTP is currently only available for Indian numbers (+91)." });
        }

        await redis.set(`otp:forgot:${identifier}`, otpHash, "EX", 600);

        if (normalizedEmail) {
            const emailData = buildForgotPasswordOtpEmail(user.name, otp);
            await sendEmail(
                normalizedEmail,
                emailData.subject,
                emailData.html,
                {
                    isHtml: true,
                    text: emailData.text,
                    attachments: emailData.attachments,
                }
            );
            res.status(200).json({ message: "OTP sent to email" });
        } else if (normalizedPhone) {
            await sendOTP(normalizedPhone, otp);
            res.status(200).json({ message: "OTP sent to phone number" });
        }
    } catch (error) {
        console.error("Forgot Password Request Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const forgotPasswordVerifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, phone, otp } = req.body;
        const identifier = email ? email.toLowerCase() : (phone ? normalizePhone(phone) : null);

        if (!identifier) {
            return res.status(400).json({ error: "Email or Phone is required" });
        }

        const savedOtpHash = await redis.get(`otp:forgot:${identifier}`);

        if (!savedOtpHash || !(await bcrypt.compare(otp, savedOtpHash))) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        const resetToken = jwt.sign(
            { email: email ? email.toLowerCase() : null, phone: phone ? normalizePhone(phone) : null },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "15m" }
        );
        await redis.del(`otp:forgot:${identifier}`);

        res.status(200).json({ resetToken });
    } catch (error) {
        console.error("Forgot Password Verify Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { resetToken, newPassword } = req.body;
        const decoded: any = jwt.verify(resetToken, process.env.JWT_SECRET || "default_secret");

        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        const updateWhere: any = {};
        if (decoded.email) updateWhere.email = decoded.email;
        if (decoded.phone) updateWhere.phone_number = decoded.phone;

        if (Object.keys(updateWhere).length === 0) {
            return res.status(400).json({ error: "Invalid reset token payload" });
        }

        await users.update({ password: passwordHash }, { where: updateWhere });

        res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        console.error("Reset Password Error:", error);
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
        // at the organization level even if they are currently in a project-specific context.
        if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'superadmin')) {
            const primaryRole = dbUser.role;

            const primaryOrganizationId = dbUser.organization_id || authUser.organization_id || null;
            if (primaryOrganizationId) {
                const primaryOrganization = await organizations.findByPk(primaryOrganizationId, {
                    attributes: ['id', 'name']
                });

                const hasOrganizationLevelPrimary = results.some((m: any) =>
                    m.role === primaryRole &&
                    !m.project_id &&
                    Number(m.organization_id) === Number(primaryOrganizationId)
                );

                if (!hasOrganizationLevelPrimary && primaryOrganization) {
                    results.push({
                        project_id: null,
                        organization_id: primaryOrganization.id,
                        user_id: dbUser.id,
                        role: primaryRole,
                        organization: primaryOrganization.toJSON ? primaryOrganization.toJSON() : primaryOrganization,
                        project: null,
                        context_type: 'organization'
                    });
                }
            }
        }

        results.forEach((entry: any) => {
            if (entry.project) {
                entry.organization_id = entry.organization_id ?? entry.project.organization_id ?? null;
                entry.organization = entry.organization ?? entry.project.organization ?? null;
                entry.context_type = entry.context_type || 'project';
            } else {
                entry.context_type = entry.context_type || 'organization';
            }
        });

        res.status(200).json({ memberships: results });
    } catch (error) {
        console.error("Get My Memberships Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const switchContext = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { project_id, organization_id, role } = req.body;
        const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : "";

        if (!normalizedRole) {
            return res.status(400).json({ error: "Role is required" });
        }
        if (!["superadmin", "admin", "contributor", "client"].includes(normalizedRole)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const user = await users.findByPk(authUser.user_id);
        const project = project_id ? await projects.findByPk(project_id) : null;
        const targetOrganizationId = project?.organization_id || organization_id || null;

        if (targetOrganizationId) {
            const organization = await organizations.findByPk(targetOrganizationId);
            if (!organization) return res.status(404).json({ error: "Organization not found" });
        }

        if (!user || (project_id && !project)) {
            return res.status(404).json({ error: "User or project not found" });
        }

        const isSuperadminSwitch = user.role === 'superadmin';
        const isAdminSwitch =
            normalizedRole === 'admin' &&
            (user.role === 'superadmin' || (user.role === 'admin' && (!targetOrganizationId || Number(targetOrganizationId) === Number(user.organization_id))));
        const isSuperadminRoleSwitch = normalizedRole === 'superadmin' && user.role === 'superadmin';

        // Security Check: If a user is trying to switch to 'admin' role, they MUST be authorized
        if (normalizedRole === 'admin' && !isAdminSwitch) {
            return res.status(403).json({ error: `You do not have any projects as an ${normalizedRole}.` });
        }

        // Project-specific role validation
        if (!isAdminSwitch && !isSuperadminRoleSwitch && !isSuperadminSwitch) {
            if (project_id) {
                const membership = await project_members.findOne({
                    where: { user_id: authUser.user_id, project_id, role: normalizedRole }
                });
                if (!membership) {
                    return res.status(403).json({ error: `You do not have a valid ${normalizedRole} membership for this project` });
                }
            } else {
                // If switching context without a specific project, verify they have at least 
                // ONE project membership globally (or in the target org if provided)
                const whereClause: any = { user_id: authUser.user_id, role: normalizedRole };
                const includeClause: any = [];

                if (targetOrganizationId) {
                    includeClause.push({
                        model: projects,
                        where: { organization_id: targetOrganizationId }
                    });
                }

                const anyMembership = await project_members.findOne({
                    include: includeClause,
                    where: whereClause
                });

                if (!anyMembership) {
                    return res.status(403).json({ error: `You do not have any projects as a ${normalizedRole}.` });
                }
            }
        }

        // Final organization context fallback
        // If we are switching to admin/superadmin role and have no specific project/org context,
        // fallback to the user's primary organization from the database.
        let finalOrgId = targetOrganizationId ? Number(targetOrganizationId) : null;
        if (!finalOrgId && (normalizedRole === 'admin' || normalizedRole === 'superadmin')) {
            finalOrgId = user.organization_id;
        }

        const token = jwt.sign(
            {
                user_id: user.id,
                name: user.name,
                role: normalizedRole,
                organization_id: finalOrgId,
                project_id: project ? project.id : null
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "30d" }
        );

        res.status(200).json({ 
            token, 
            user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number, role: normalizedRole }
        });
    } catch (error) {
        console.error("Switch Context Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
