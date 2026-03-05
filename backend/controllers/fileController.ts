import type { Request, Response } from "express";
import db from "../models/index.ts";
const { files, folders, project_members, activities } = db;
import { Op } from "sequelize";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from 'sharp';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "ap-south-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "apexis-bucket";

// Helper to check access
const checkProjectAccess = async (userId: number, projectId: number) => {
    return await project_members.findOne({
        where: { user_id: userId, project_id: projectId }
    });
};

export const uploadFile = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { folder_id, project_id, skipActivity } = req.body;

        if (!(req as any).file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file_name = (req as any).file.originalname;
        const file_type = (req as any).file.mimetype;
        const file_size_mb = Math.max(1, Math.round((req as any).file.size / (1024 * 1024)));

        // Ensure contributors have access to this project
        if (authUser.role === "contributor") {
            const access = await checkProjectAccess(authUser.user_id, project_id);
            if (!access || access.role !== "contributor") {
                return res.status(403).json({ error: "Forbidden: Not a contributor to this project" });
            }
        }

        const validFolderId = (folder_id !== undefined && folder_id !== null && folder_id !== 'undefined' && folder_id !== '') ? parseInt(folder_id, 10) : null;
        let finalFolderId = validFolderId;

        const folderPath = finalFolderId ? finalFolderId.toString() : 'root';

        // Extract extension and generate sanitized S3 key
        const extMatch = (req as any).file.originalname.match(/\.[0-9a-z]+$/i);
        const extension = extMatch ? extMatch[0] : '';
        const s3Key = `projects/${project_id}/folders/${folderPath}/${Date.now()}${extension}`;

        let fileBuffer = req.file.buffer;
        let finalFileName = file_name;

        // Apply compression and watermarking only to images
        if (file_type.startsWith('image/')) {
            const timestamp = new Date().toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium',
                timeStyle: 'short'
            });

            const svgOverlay = `
                <svg width="600" height="100">
                    <style>
                        .title { fill: #e98b06; font-size: 24px; font-family: sans-serif; font-weight: bold; }
                    </style>
                    <text x="10" y="40" class="title" fill="#e98b06" stroke="black" stroke-width="0.5">${timestamp}</text>
                </svg>
            `;

            try {
                fileBuffer = await sharp(req.file.buffer)
                    .resize({ width: 1280, withoutEnlargement: true })
                    .composite([
                        {
                            input: Buffer.from(svgOverlay),
                            gravity: 'southwest',
                        }
                    ])
                    .jpeg({ quality: 60 })
                    .toBuffer();

                // Force extension to jpg since we are converting
                finalFileName = file_name.replace(/\.[^/.]+$/, "") + ".jpg";
            } catch (sharpErr) {
                console.error("Sharp processing failed, falling back to original", sharpErr);
                // Fallback to original buffer if sharp fails
            }
        }

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ContentType: file_type,
            Body: fileBuffer
        });

        await s3Client.send(command);

        const newFile = await files.create({
            folder_id: finalFolderId,
            project_id: parseInt(project_id, 10),
            file_url: s3Key,
            file_name: finalFileName,
            file_type,
            file_size_mb,
            created_by: authUser.user_id,
        });

        // Grouping API logic - skip if true
        if (skipActivity !== 'true') {
            await activities.create({
                project_id: parseInt(project_id, 10),
                user_id: authUser.user_id,
                type: file_type.startsWith('image/') ? 'upload_photo' : 'upload',
                description: `Uploaded ${finalFileName}`
            });
        }

        res.status(200).json({
            message: "File uploaded successfully",
            file: newFile
        });
    } catch (error) {
        console.error("Upload File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const listFiles = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { projectId } = req.params;

        // Verify access if contributor or client
        if (authUser.role === "contributor" || authUser.role === "client") {
            const access = await checkProjectAccess(authUser.user_id, Number(projectId));
            if (!access) {
                return res.status(403).json({ error: "Forbidden: No access to this project" });
            }
        }

        // Get all folders for this project
        const folderData = await folders.findAll({
            where: { project_id: projectId },
        });

        const folderIds = folderData.map((f: any) => f.id);

        // Get all files for this project (either by explicit project_id or via folder_id)
        const fileData = await files.findAll({
            where: {
                [Op.or]: [
                    { project_id: projectId },
                    { folder_id: { [Op.in]: folderIds } }
                ]
            }
        });

        let filteredFolders = folderData.map((f: any) => f.toJSON());
        let filteredFiles = fileData.map((f: any) => f.toJSON());

        if (authUser.role === "client") {
            // Remove hidden folders
            filteredFolders = filteredFolders.filter((folder: any) => folder.client_visible !== false);
            // Remove hidden files
            filteredFiles = filteredFiles.filter((file: any) => file.client_visible !== false);
        }

        // Generate presigned GET URLs for all files
        const finalizedFiles = await Promise.all(filteredFiles.map(async (file: any) => {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: file.file_url
            });
            file.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return file;
        }));

        res.status(200).json({ folderData: filteredFolders, fileData: finalizedFiles });
    } catch (error) {
        console.error("List Files Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteFile = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { fileId } = req.params;

        // Only admins and superadmins can delete
        if (authUser.role !== "admin" && authUser.role !== "superadmin") {
            return res.status(403).json({ error: "Only admins can delete files" });
        }

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.file_url
        });

        await s3Client.send(command);

        await activities.create({
            project_id: file.project_id,
            user_id: authUser.user_id,
            type: 'delete',
            description: `Deleted ${file.file_name}`
        });

        await file.destroy();

        res.status(200).json({ message: "File deleted successfully" });
    } catch (error) {
        console.error("Delete File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const toggleFileVisibility = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        if (authUser.role !== "admin" && authUser.role !== "superadmin") {
            return res.status(403).json({ error: "Forbidden: Only Admins can toggle file visibility" });
        }

        const { fileId } = req.params;
        const { client_visible } = req.body;

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        file.client_visible = client_visible;
        await file.save();

        res.status(200).json({ message: "File visibility updated", file });
    } catch (error) {
        console.error("Toggle File Visibility Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
