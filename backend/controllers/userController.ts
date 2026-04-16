import type { Request, Response } from "express";
import {
    users,
    projects,
    project_members,
    room_members,
    notifications,
    snags,
    rfis,
    organizations,
    sequelize
} from "../models/index.ts";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/email.ts";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';
import { Op } from "sequelize";
import { getIO } from "../socket.ts";

export const inviteUser = async (req: Request, res: Response) => {
    try {
        const { role, email, project_id, projectId } = req.body;
        const actualProjectId = project_id || projectId;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can invite users" });
        }

        if (!["contributor", "admin", "client"].includes(role)) {
            return res.status(400).json({ error: "Invalid role specified" });
        }

        if ((role === 'contributor' || role === 'client') && !actualProjectId) {
            return res.status(400).json({ error: "ProjectId is required for contributor/client invitations" });
        }

        // Unified Invitation Logic for all roles
        let user = await users.findOne({ where: { email } });
        let isNewUser = false;

        if (!user) {
            user = await users.create({
                organization_id: authUser.organization_id,
                name: "Pending",
                email,
                role,
                is_primary: false,
                email_verified: false,
            });
            isNewUser = true;
        } else {
            // User exists.
            if (user.organization_id && user.organization_id !== authUser.organization_id) {
                return res.status(400).json({
                    error: "User is already registered with another organization. Cross-organization invitations are not permitted for security reasons."
                });
            }

            // If user exists but has no organization (invited but not registered), assign current one
            if (!user.organization_id) {
                await user.update({ organization_id: authUser.organization_id });
            }
        }

        // For Project Roles, pre-associate with the project
        if ((role === 'contributor' || role === 'client') && actualProjectId) {
            const existingMembership = await project_members.findOne({
                where: { project_id: actualProjectId, user_id: user.id }
            });

            if (!existingMembership) {
                await project_members.create({
                    project_id: actualProjectId,
                    user_id: user.id,
                    role: role
                });
            } else if (existingMembership.role === role) {
                return res.status(400).json({ error: `User is already a ${role} in this project` });
            } else {
                // Already a member with different role, update it or leave it?
                // For now, let's allow updating to the new invited role
                await existingMembership.update({ role });
            }

            // Emit socket event to refresh project stats (counts) in real-time
            try {
                getIO().to(`project-${actualProjectId}`).emit('project-stats-updated', { projectId: String(actualProjectId) });
            } catch (ioErr) {
                console.error('Socket emit error (non-fatal):', ioErr);
            }
        }

        // Generate invitation token
        const token = jwt.sign(
            { user_id: user.id, email: user.email, organization_id: authUser.organization_id },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "48h" }
        );

        // Smart Link to Web Landing Page (which redirects to app)
        let inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/invite?token=${token}`;
        const roleName = role.charAt(0).toUpperCase() + role.slice(1);

        if ((role === 'contributor' || role === 'client') && actualProjectId) {
            const project = await projects.findOne({ where: { id: actualProjectId } });
            if (project) {
                const code = role === 'contributor' ? project.contributor_code : project.client_code;
                inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/login-redirect?role=${role}&code=${code}`;
            }
        }

        const org = await organizations.findByPk(authUser.organization_id);
        const organization_name = org ? org.name : "your organization";

        await sendEmail(
            email,
            `Invitation to join APEXISpro™ as ${roleName}`,
            `<div style="font-family: Arial, Helvetica, sans-serif; color: #14213d;">
                <div style="font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 20px;">
                    APEXIS <span style="font-size: 16px;">PRO™</span>
                </div>
                <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Welcome to APEXIS<span style="font-size: 14px;">PRO™</span></h1>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 12px;">You have been invited to join <strong>"${organization_name}"</strong> on APEXIS <span style="font-size: 13px;">PRO™</span>.</p>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Please click the link below to securely login to your project in the APEXIS<span style="font-size: 13px;">PRO™</span> mobile app:</p>
                <a href="${inviteUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Login to Project</a>
                <p style="font-size: 14px; color: #64748b; margin-top: 24px;">If you don't have the app installed, the link will guide you to the App Store or Play Store.</p>
             </div>`,
            true
        );

        return res.status(201).json({ message: `${roleName} invited successfully`, user: user });

    } catch (error) {
        console.error("Invite User Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getOrgUsers = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // 1. Find all organizations the user belongs to
        const myProjectOrgs = await project_members.findAll({
            where: { user_id: authUser.user_id },
            include: [{ model: projects, as: 'project', attributes: ['organization_id'] }]
        }).then((pms: any) => pms.map((pm: any) => pm.project?.organization_id).filter(Boolean));

        const myOrgs = [...new Set([authUser.organization_id, ...myProjectOrgs].filter(Boolean))];

        let whereCondition: any = { organization_id: { [Op.in]: myOrgs } };

        if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
            // Non-admins: See users who share a project with them, PLUS all admins of their org
            const myProjectIds = await project_members.findAll({
                where: { user_id: authUser.user_id },
                attributes: ['project_id']
            }).then((pms: any[]) => pms.map((pm: any) => pm.project_id));

            const peerUserIds = await project_members.findAll({
                where: { project_id: { [Op.in]: myProjectIds } },
                attributes: ['user_id']
            }).then((pms: any[]) => pms.map((pm: any) => pm.user_id));

            // Always include admins of the organizations the user belongs to,
            // so contributors/clients can always message their project admin(s).
            const adminUserIds = await users.findAll({
                where: {
                    organization_id: { [Op.in]: myOrgs },
                    role: 'admin'
                },
                attributes: ['id']
            }).then((admins: any[]) => admins.map((a: any) => a.id));

            whereCondition.id = { [Op.in]: [...new Set([...peerUserIds, ...adminUserIds, authUser.user_id])] };
        }

        const orgUsers = await users.findAll({
            where: whereCondition,
            attributes: ['id', 'name', 'email', 'phone_number', 'role', 'profile_pic', 'is_primary', 'email_verified', 'phone_verified', 'createdAt', 'organization_id'],
            include: [{ model: organizations, attributes: ['name'] }]
        });

        res.status(200).json({ users: orgUsers });
    } catch (error) {
        console.error("Get Org Users Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            await t.rollback();
            return res.status(403).json({ error: "Forbidden: Only admins can delete users" });
        }

        const userToDelete = await users.findOne({
            where: {
                id,
                organization_id: authUser.organization_id
            },
            transaction: t
        });

        if (!userToDelete) {
            await t.rollback();
            return res.status(404).json({ error: "User not found in your organization" });
        }

        if (userToDelete.is_primary) {
            await t.rollback();
            return res.status(400).json({ error: "Cannot delete the primary organization administrator" });
        }

        if (String(userToDelete.id) === String(authUser.user_id)) {
            await t.rollback();
            return res.status(400).json({ error: "You cannot remove yourself" });
        }

        if (["admin", "superadmin"].includes(userToDelete.role)) {
            await t.rollback();
            return res.status(400).json({ error: "Admins cannot be removed from projects" });
        }

        const memberships = await project_members.findAll({
            where: { user_id: id },
            attributes: ['project_id'],
            transaction: t,
        });
        const affectedProjectIds = memberships.map((m: any) => m.project_id);

        // Remove the user from all projects they currently belong to.
        await project_members.destroy({ where: { user_id: id }, transaction: t });
        await room_members.destroy({ where: { user_id: id }, transaction: t });
        await notifications.destroy({ where: { user_id: id }, transaction: t });

        // 2. Nullify assignees (Safe to nullify)
        await snags.update({ assigned_to: null }, { where: { assigned_to: id }, transaction: t });
        await rfis.update({ assigned_to: null }, { where: { assigned_to: id }, transaction: t });

        for (const projectId of affectedProjectIds) {
            try {
                getIO().to(`project-${projectId}`).emit('project-stats-updated', { projectId: String(projectId) });
            } catch (ioErr) {
                console.error('Socket emit error (non-fatal):', ioErr);
            }
        }

        await t.commit();
        res.status(200).json({ message: "Project access removed successfully" });
    } catch (error: any) {
        await t.rollback();
        console.error("Delete User Error:", error);

        if (error.name === 'SequelizeForeignKeyConstraintError') {
            const table = error.table || '';
            let details = "This user is referenced by other project data.";

            if (table === 'files' || table === 'folders') {
                details = `User cannot be removed because they have created ${table}. Please deactivate the user instead or reassign their data.`;
            } else if (table === 'rfis' || table === 'projects') {
                details = `User cannot be removed because they are the creator of ${table}.`;
            }

            return res.status(400).json({
                error: "Conflict: User has critical project data",
                details
            });
        }

        res.status(500).json({ error: "Internal server error" });
    }
};




export const updatePushToken = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        const authUser = (req as any).user;

        if (!authUser) return res.status(401).json({ error: "Unauthorized" });
        if (!token) return res.status(400).json({ error: "Token is required" });

        // 1. Remove this token from any other users to prevent cross-account notifications on shared devices
        await users.update({ fcm_token: null }, {
            where: {
                fcm_token: token,
                id: { [Op.ne]: authUser.user_id }
            }
        });

        // 2. Set the token for the current user
        await users.update({ fcm_token: token }, { where: { id: authUser.user_id } });

        res.status(200).json({ message: "Push token updated successfully" });
    } catch (error) {
        console.error("Update Push Token Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateProfilePic = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });
        if (!(req as any).file) return res.status(400).json({ error: "No image provided" });

        const file = (req as any).file;
        const fileBuffer = await sharp(file.buffer)
            .resize(400, 400, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();

        const key = `profiles/${authUser.user_id}/${Date.now()}.jpg`;

        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: 'image/jpeg',
            Body: fileBuffer,
        }));

        await users.update({ profile_pic: key }, { where: { id: authUser.user_id } });

        res.status(200).json({
            message: "Profile picture updated successfully",
            profile_pic: key
        });
    } catch (error) {
        console.error("Update Profile Pic Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateUserName = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { name } = req.body;

        if (!authUser) return res.status(401).json({ error: "Unauthorized" });
        if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });

        await users.update({ name: name.trim() }, { where: { id: authUser.user_id } });

        res.status(200).json({ message: "Name updated successfully", name: name.trim() });
    } catch (error) {
        console.error("Update User Name Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getOnboardingLinks = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can get onboarding links" });
        }

        const orgId = authUser.organization_id;

        const contributorToken = jwt.sign(
            { organization_id: orgId, role: "contributor", type: "public_onboarding" },
            process.env.JWT_SECRET || "default_secret"
        );
        const clientToken = jwt.sign(
            { organization_id: orgId, role: "client", type: "public_onboarding" },
            process.env.JWT_SECRET || "default_secret"
        );

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        res.status(200).json({
            contributor_link: `${baseUrl}/auth/onboarding?token=${contributorToken}`,
            client_link: `${baseUrl}/auth/onboarding?token=${clientToken}`
        });
    } catch (error) {
        console.error("Get Onboarding Links Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
