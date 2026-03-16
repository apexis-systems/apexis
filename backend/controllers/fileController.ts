import type { Request, Response } from "express";
import db from "../models/index.ts";
const { files, folders, project_members, activities } = db;
import { Op } from "sequelize";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from 'sharp';
import { sendNotification } from "../utils/notificationUtils.ts";
import { users as UsersModel } from "../models/index.ts";

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

            try {
                const image = sharp((req as any).file.buffer);
                const metadata = await image.metadata();
                const originalWidth = metadata.width || 1280;
                const finalWidth = Math.min(originalWidth, 1280);

                // Dynamically adjust font size to width
                const fontSize = Math.max(14, Math.min(36, Math.round(finalWidth * 0.035)));
                const svgWidth = finalWidth;
                const svgHeight = Math.round(fontSize * 2.5);
                const yPos = Math.round(fontSize * 1.5);

                const svgOverlay = `
                    <svg width="${svgWidth}" height="${svgHeight}">
                        <style>
                            .title { fill: #e98b06; font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; }
                        </style>
                        <text x="15" y="${yPos}" class="title" stroke="black" stroke-width="${fontSize < 20 ? 0.3 : 0.6}">${timestamp}</text>
                    </svg>
                `;

                fileBuffer = await image
                    .resize({ width: 1280, withoutEnlargement: true })
                    .composite([{ input: Buffer.from(svgOverlay), gravity: 'southwest' }])
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
            client_visible: true,
            file_type,
            file_size_mb,
            created_by: authUser.user_id,
        });

        // Send notifications to project members
        const members = await project_members.findAll({
            where: { project_id: parseInt(project_id, 10), user_id: { [Op.ne]: authUser.user_id } }
        });

        for (const member of members) {
            await sendNotification({
                userId: member.user_id,
                title: 'New File Uploaded',
                body: `${authUser.name} uploaded ${finalFileName}`,
                type: 'file_upload',
                data: { fileId: String(newFile.id), projectId: String(project_id) }
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
            },
            include: [{
                model: UsersModel,
                as: 'creator',
                attributes: ['id', 'name', 'email']
            }]
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

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Only admins, superadmins, or the creator can delete
        if (
            authUser.role !== "admin" &&
            authUser.role !== "superadmin" &&
            String(file.created_by) !== String(authUser.user_id)
        ) {
            return res.status(403).json({ error: "Unauthorized: only admins or the uploader can delete this file" });
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

        if (client_visible) {
            // Notify clients in the organization
            const clients = await UsersModel.findAll({
                where: { organization_id: authUser.organization_id, role: 'client' }
            });

            for (const client of clients) {
                await sendNotification({
                    userId: (client as any).id,
                    title: 'New File Available',
                    body: `A new file "${file.file_name}" is now visible to you.`,
                    type: 'file_visibility',
                    data: { fileId: String(file.id), projectId: String(file.project_id) }
                });
            }
        }

        res.status(200).json({ message: "File visibility updated", file });
    } catch (error) {
        console.error("Toggle File Visibility Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const viewFile = async (req: Request, res: Response) => {
    try {
        const { fileKey } = req.body;
        if (!fileKey) {
            return res.status(400).json({ error: "No file key provided" });
        }

        // console.log(`[DEBUG] Attempting to view file: ${fileKey} in bucket: ${BUCKET_NAME}`);

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
        });

        const s3Item = await s3Client.send(command);

        if (s3Item.ContentType) {
            res.setHeader("Content-Type", s3Item.ContentType);
        }

        // s3Item.Body is a Readable stream in Node.js for AWS SDK v3
        if (s3Item.Body) {
            // For AWS SDK v3 responses in Node.js, Body is usually a stream or has transformToWebStream
            if (typeof (s3Item.Body as any).pipe === "function") {
                (s3Item.Body as any).pipe(res);
            } else if (typeof (s3Item.Body as any).transformToWebStream === "function") {
                // Some versions of SDK v3 might need this or simply be piped
                const webStream = (s3Item.Body as any).transformToWebStream();
                const reader = webStream.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                res.end();
            } else {
                console.error("[ERROR] Unexpected S3 Body type:", typeof s3Item.Body);
                res.status(500).json({ error: "S3 item body is not a stream" });
            }
        } else {
            console.error("[ERROR] S3 item body is empty for key:", fileKey);
            res.status(404).json({ error: "File body is empty" });
        }
    } catch (error: any) {
        console.error(`[ERROR] View File Error for key ${req.body.fileKey}:`, error.message);
        if (error.name === "NoSuchKey") {
            return res.status(404).json({ error: "File not found in S3" });
        }
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
};

export const bulkUpdateFiles = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { ids, folder_id, client_visible } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "No file IDs provided" });
        }

        // Move action permissions: Admins and Contributors
        if (folder_id !== undefined) {
            if (authUser.role !== "admin" && authUser.role !== "contributor") {
                return res.status(403).json({ error: "Forbidden: Only Admins and Contributors can move files" });
            }
        }

        // Visibility action permissions: Admins only
        if (client_visible !== undefined) {
            if (authUser.role !== "admin" && authUser.role !== "superadmin") {
                return res.status(403).json({ error: "Forbidden: Only Admins can toggle file visibility" });
            }
        }

        const updateData: any = {};
        if (folder_id !== undefined) updateData.folder_id = (folder_id === '' || folder_id === 'root') ? null : folder_id;
        if (client_visible !== undefined) updateData.client_visible = client_visible;

        await files.update(updateData, {
            where: { id: ids }
        });

        // Activity logging (simplified)
        if (ids.length > 0) {
            const firstFile = await files.findByPk(ids[0]);
            if (firstFile) {
                await activities.create({
                    project_id: firstFile.project_id,
                    user_id: authUser.user_id,
                    type: 'edit',
                    description: `Bulk updated ${ids.length} files`
                });
            }
        }

        res.status(200).json({ message: "Files updated successfully" });
    } catch (error) {
        console.error("Bulk Update Files Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

