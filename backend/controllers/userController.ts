import type { Request, Response } from "express";
import { users, projects } from "../models/index.ts";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/email.ts";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

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
        const existingUser = await users.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists with this email" });
        }

        const newUser = await users.create({
            organization_id: authUser.organization_id,
            name: "Pending",
            email,
            role,
            is_primary: false,
            email_verified: false,
        });

        // For Project Roles, pre-associate with the project
        if ((role === 'contributor' || role === 'client') && actualProjectId) {
            const { project_members: ProjectMember } = await import("../models/index.ts");
            await ProjectMember.create({
                project_id: actualProjectId,
                user_id: newUser.id,
                role: role
            });
        }

        // Generate invitation token
        const token = jwt.sign(
            { user_id: newUser.id, email: newUser.email, organization_id: authUser.organization_id },
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

        await sendEmail(
            email,
            `Invitation to join Apexis as ${roleName}`,
            `<h1>Welcome to Apexis</h1>
             <p>You have been invited as a <strong>${roleName}</strong> for your organization.</p>
             <p>Please click the link below to securely login to your project in the Apexis mobile app:</p>
             <a href="${inviteUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Login to Project</a>
             <p>If you don't have the app installed, the link will guide you to the App Store or Play Store.</p>`,
            true
        );

        return res.status(201).json({ message: `${roleName} invited successfully`, user: newUser });

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

        const orgUsers = await users.findAll({
            where: { organization_id: authUser.organization_id },
            attributes: ['id', 'name', 'email', 'phone_number', 'role', 'is_primary', 'email_verified', 'phone_verified', 'createdAt']
        });

        res.status(200).json({ users: orgUsers });
    } catch (error) {
        console.error("Get Org Users Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Only admins can delete users" });
        }

        const userToDelete = await users.findOne({
            where: {
                id,
                organization_id: authUser.organization_id
            }
        });

        if (!userToDelete) {
            return res.status(404).json({ error: "User not found in your organization" });
        }

        if (userToDelete.is_primary) {
            return res.status(400).json({ error: "Cannot delete the primary organization administrator" });
        }

        if (String(userToDelete.id) === String(authUser.user_id)) {
            return res.status(400).json({ error: "You cannot delete yourself" });
        }

        await userToDelete.destroy();

        res.status(200).json({ message: "User removed successfully" });
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const BUCKET = process.env.S3_BUCKET_NAME || 'apexis-bucket';

export const updatePushToken = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        const authUser = (req as any).user;

        if (!authUser) return res.status(401).json({ error: "Unauthorized" });
        if (!token) return res.status(400).json({ error: "Token is required" });

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
            Bucket: BUCKET,
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
