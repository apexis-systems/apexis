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
import { Op, Sequelize } from "sequelize";
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
                name: "New User",
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
            // Prevent assigning restricted project roles to organization admins within their own organization
            if (user && user.role === 'admin' && user.organization_id === authUser.organization_id) {
                return res.status(400).json({ error: "This user is an Admin of this organization and already has full access to the project." });
            }

            const existingMembership = await project_members.findOne({
                where: { project_id: actualProjectId, user_id: user.id }
            });

            if (!existingMembership) {
                await project_members.create({
                    project_id: actualProjectId,
                    user_id: user.id,
                    role: role
                });
            } else if (existingMembership.role !== role) {
                return res.status(400).json({ 
                    error: `User is already a ${existingMembership.role} in this project. You cannot assign multiple roles to the same project.` 
                });
            } else {
                return res.status(400).json({ error: `User is already a ${role} in this project` });
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

        // Fetch user from DB to get their TRUE base role and primary organization
        const dbUser = await users.findByPk(authUser.user_id);
        if (!dbUser) return res.status(404).json({ error: "User not found" });

        const baseRole = dbUser.role;
        const primaryOrgId = dbUser.organization_id;

        let whereCondition: any = {};

        const purpose = req.query.purpose as string;
        let allAccessibleProjectIds: number[] = [];

        if (baseRole === 'superadmin') {
            whereCondition = {};
        } else {
            // 1. Get projects where user is involved
            const myExplicitMemberships = await project_members.findAll({
                where: { user_id: authUser.user_id },
                attributes: ['project_id']
            });
            const explicitProjectIds = myExplicitMemberships.map((pm: any) => pm.project_id);

            let adminOwnedProjectIds: number[] = [];
            if (baseRole === 'admin' && primaryOrgId) {
                const ownedProjects = await projects.findAll({
                    where: { organization_id: primaryOrgId },
                    attributes: ['id']
                });
                adminOwnedProjectIds = ownedProjects.map((p: any) => p.id);
            }

            allAccessibleProjectIds = [...new Set([...explicitProjectIds, ...adminOwnedProjectIds])];

            // 2. Identify all peers in these projects
            let peerUserIds: number[] = [];
            if (allAccessibleProjectIds.length > 0) {
                const projectPeers = await project_members.findAll({
                    where: { project_id: { [Op.in]: allAccessibleProjectIds } },
                    attributes: ['user_id']
                });
                peerUserIds = projectPeers.map((pm: any) => pm.user_id);
            }

            // 3. Admins also see their project creators (if they are contributors elsewhere)
            const projectCreators = await projects.findAll({
                where: { id: { [Op.in]: allAccessibleProjectIds } },
                attributes: ['created_by']
            });
            const creatorIds = projectCreators.map((p: any) => p.created_by);

            const allowedUserIds = new Set([...peerUserIds, ...creatorIds, authUser.user_id]);

            if (baseRole === 'admin' && primaryOrgId) {
                // If for management, strictly staff. If for chat/assignment, broader.
                if (purpose === 'management') {
                    whereCondition = { organization_id: primaryOrgId };
                } else {
                    whereCondition = {
                        [Op.or]: [
                            { organization_id: primaryOrgId },
                            { id: { [Op.in]: [...allowedUserIds] } }
                        ]
                    };
                }
            } else {
                whereCondition = { id: { [Op.in]: [...allowedUserIds] } };
            }
        }

        const rawUsers = await users.findAll({
            where: whereCondition,
            attributes: ['id', 'name', 'email', 'phone_number', 'role', 'profile_pic', 'is_primary', 'email_verified', 'phone_verified', 'createdAt', 'organization_id'],
            include: [
                { model: organizations, attributes: ['name'] },
                { 
                    model: project_members, 
                    attributes: ['role', 'project_id'],
                    where: allAccessibleProjectIds.length > 0 ? { project_id: { [Op.in]: allAccessibleProjectIds } } : undefined,
                    required: false,
                    include: [{ model: projects, attributes: ['name'] }]
                }
            ]
        });

        // 4. Post-process to add "Project Admin" roles for creators who aren't in project_members
        const orgUsers = await Promise.all(rawUsers.map(async (u: any) => {
            const userJson = u.toJSON();
            
            // Find projects created by this user that are also accessible to the requester
            const createdProjects = await projects.findAll({
                where: { 
                    created_by: u.id,
                    id: { [Op.in]: allAccessibleProjectIds }
                },
                attributes: ['id', 'name']
            });

            createdProjects.forEach((p: any) => {
                // Check if already in project_members
                const exists = userJson.project_members.some((pm: any) => pm.project_id === p.id);
                if (!exists) {
                    userJson.project_members.push({
                        role: 'admin',
                        project_id: p.id,
                        project: { name: p.name }
                    });
                }
            });

            return userJson;
        }));

        res.status(200).json({ users: orgUsers });
    } catch (error) {
        console.error("Get Org Users Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getProjectsUsers = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Fetch user from DB to get their TRUE base role and primary organization
        const dbUser = await users.findByPk(authUser.user_id);
        if (!dbUser) return res.status(404).json({ error: "User not found" });

        const baseRole = dbUser.role;
        const primaryOrgId = dbUser.organization_id;

        // Fetch all projects created by this user
        const userProjects = await projects.findAll({
            where: { created_by: authUser.user_id },
            attributes: ['id', 'name']
        });

        const projectIds = userProjects.map((p: any) => p.id);

        if (projectIds.length === 0) {
            return res.status(200).json({ users: [] });
        }

        // Fetch the contributors and clients in those projects
        const memberships = await project_members.findAll({
            where: {
                project_id: { [Op.in]: projectIds },
                role: { [Op.in]: ['contributor', 'client'] }
            },
            attributes: ['user_id']
        });

        const memberUserIds = [...new Set(memberships.map((m: any) => m.user_id))];

        if (memberUserIds.length === 0) {
            return res.status(200).json({ users: [] });
        }

        const rawUsers = await users.findAll({
            where: { id: { [Op.in]: memberUserIds } },
            attributes: ['id', 'name', 'email', 'phone_number', 'role', 'profile_pic', 'is_primary', 'email_verified', 'phone_verified', 'createdAt', 'organization_id'],
            include: [
                { model: organizations, attributes: ['name'] },
                { 
                    model: project_members, 
                    attributes: ['role', 'project_id'],
                    where: { project_id: { [Op.in]: projectIds } },
                    required: false,
                    include: [{ model: projects, attributes: ['name'] }]
                }
            ]
        });

        const projectUsers = await Promise.all(rawUsers.map(async (u: any) => {
            const userJson = u.toJSON();
            
            // Find projects created by this user that are also accessible to the requester
            const createdProjects = await projects.findAll({
                where: { 
                    created_by: u.id,
                    id: { [Op.in]: projectIds }
                },
                attributes: ['id', 'name']
            });

            createdProjects.forEach((p: any) => {
                // Check if already in project_members
                const exists = userJson.project_members.some((pm: any) => pm.project_id === p.id);
                if (!exists) {
                    userJson.project_members.push({
                        role: 'admin',
                        project_id: p.id,
                        project: { name: p.name }
                    });
                }
            });

            if (userJson.id === authUser.user_id) {
                userJson.role = 'admin';
            } else {
                userJson.role = userJson.project_members?.[0]?.role;
            }

            return userJson;
        }));

        res.status(200).json({ users: projectUsers });
    } catch (error) {
        console.error("Get Projects Users Error:", error);
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

        const userToDelete = await users.findByPk(id, { transaction: t });
        if (!userToDelete) {
            await t.rollback();
            return res.status(404).json({ error: "User not found" });
        }

        if (userToDelete.is_primary && userToDelete.organization_id === authUser.organization_id) {
            await t.rollback();
            return res.status(400).json({ error: "Cannot delete the primary organization administrator" });
        }

        if (String(userToDelete.id) === String(authUser.user_id)) {
            await t.rollback();
            return res.status(400).json({ error: "You cannot remove yourself" });
        }

        // 1. Identify projects owned by the Admin's organization
        const ownedProjects = await projects.findAll({
            where: { organization_id: authUser.organization_id },
            attributes: ['id'],
            transaction: t
        });
        const ownedProjectIds = ownedProjects.map((p: any) => p.id);

        // 2. Find memberships for this user in THESE projects
        const memberships = await project_members.findAll({
            where: { 
                user_id: id,
                project_id: { [Op.in]: ownedProjectIds }
            },
            attributes: ['project_id'],
            transaction: t,
        });
        const affectedProjectIds = memberships.map((m: any) => m.project_id);

        // 3. Remove memberships and associated data ONLY for these projects
        await project_members.destroy({ 
            where: { 
                user_id: id, 
                project_id: { [Op.in]: ownedProjectIds }
            }, 
            transaction: t 
        });
        
        if (ownedProjectIds.length > 0) {
            await room_members.destroy({ 
                where: { 
                    user_id: id,
                    room_id: {
                        [Op.in]: Sequelize.literal(`(SELECT id FROM rooms WHERE project_id IN (${ownedProjectIds.join(',')}))`)
                    }
                }, 
                transaction: t 
            });

            // 4. Nullify assignees for tasks in these projects
            await snags.update({ assigned_to: null }, { 
                where: { 
                    assigned_to: id,
                    project_id: { [Op.in]: ownedProjectIds }
                }, 
                transaction: t 
            });
            
            await rfis.update({ assigned_to: null }, { 
                where: { 
                    assigned_to: id,
                    project_id: { [Op.in]: ownedProjectIds }
                }, 
                transaction: t 
            });
        }

        // 5. Remove from organization (un-link)
        if (userToDelete.organization_id === authUser.organization_id) {
            await userToDelete.update({ organization_id: null }, { transaction: t });
        }

        // 6. Notify affected projects
        for (const projectId of affectedProjectIds) {
            try {
                getIO().to(`project-${projectId}`).emit('project-stats-updated', { projectId: String(projectId) });
            } catch (ioErr) {
                console.error('Socket emit error (non-fatal):', ioErr);
            }
        }

        await t.commit();
        res.status(200).json({ message: "User removed from organization successfully" });
    } catch (error: any) {
        await t.rollback();
        console.error("Delete User Error:", error);

        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({
                error: "Conflict: User has critical project data",
                details: "This user is referenced by other project records. Try deactivating them instead."
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

export const updateNotificationSettings = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { mute_general_notifications } = req.body;

        if (!authUser) return res.status(401).json({ error: "Unauthorized" });
        if (authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can update this setting" });
        }
        if (typeof mute_general_notifications !== "boolean") {
            return res.status(400).json({ error: "mute_general_notifications must be a boolean" });
        }

        await users.update(
            { mute_general_notifications },
            { where: { id: authUser.user_id } }
        );

        res.status(200).json({
            message: "Notification settings updated successfully",
            mute_general_notifications
        });
    } catch (error) {
        console.error("Update Notification Settings Error:", error);
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
