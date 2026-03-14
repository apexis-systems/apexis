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

        // Logic for Admin role (Full user creation + Deep Link)
        if (role === 'admin') {
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

            // Generate invitation token
            const token = jwt.sign(
                { user_id: newUser.id, email: newUser.email, organization_id: authUser.organization_id },
                process.env.JWT_SECRET || "default_secret",
                { expiresIn: "48h" }
            );

            // Smart Link to Web Landing Page (which redirects to app)
            const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/invite?token=${token}`;

            await sendEmail(
                email,
                "Invitation to join Apexis as Admin",
                `<h1>Welcome to Apexis</h1>
                 <p>You have been invited as an Admin for your organization.</p>
                 <p>Please click the link below to set up your account in the Apexis mobile app:</p>
                 <a href="${inviteUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Set Up Account</a>
                 <p>If you don't have the app installed, the link will guide you to the App Store or Play Store.</p>`,
                true
            );

            return res.status(201).json({ message: "Admin invited successfully", user: newUser });
        }

        // Logic for Contributor/Client role (Project Code only)
        if (role === 'contributor' || role === 'client') {
            const project = await projects.findOne({ where: { id: actualProjectId, organization_id: authUser.organization_id } });
            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            const code = role === 'contributor' ? project.contributor_code : project.client_code;
            const roleName = role.charAt(0).toUpperCase() + role.slice(1);

            await sendEmail(
                email,
                `Apexis: Invitation to join ${project.name}`,
                `<h1>Project Invitation</h1>
                 <p>You have been invited to join the project <strong>${project.name}</strong> as a ${roleName}.</p>
                 <p>Please use the following access code to join the project in the Apexis mobile app:</p>
                 <div style="font-size: 24px; font-weight: bold; padding: 20px; background: #f4f4f4; text-align: center; border-radius: 8px; margin: 20px 0;">
                    ${code}
                 </div>
                 <p>Open the Apexis app and enter this code to get started.</p>`,
                true
            );

            return res.status(200).json({ message: `${roleName} invitation sent with project code` });
        }

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
            attributes: ['id', 'name', 'email', 'role', 'is_primary', 'email_verified', 'createdAt']
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
