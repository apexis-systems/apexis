import type { Request, Response } from "express";
import 'multer';
import db from "../models/index.ts";
const { files, folders, project_members, activities, users, organizations, projects } = db;

import { Op } from "sequelize";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from 'sharp';
import { addWatermark } from "../utils/watermark.ts";
import { sendNotification } from "../utils/notificationUtils.ts";
import { users as UsersModel } from "../models/index.ts";
import { PDFDocument } from 'pdf-lib';
import { getIO } from '../socket.ts';
import { logActivity } from "../utils/activityUtils.ts";
import { checkStorageLimit, checkSubscriptionStatus } from "../utils/subscriptionAccess.ts";

interface MulterFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

// Helper to check access
const checkProjectAccess = async (userId: number, projectId: number, role: string, orgId?: number | null) => {
    // 1. Check explicit project membership
    const membership = await project_members.findOne({
        where: { user_id: userId, project_id: projectId }
    });
    if (membership) return membership;

    // 2. If not a member, check if they are an admin of the project's organization
    if (role === 'admin' || role === 'superadmin') {
        const project = await projects.findByPk(projectId);
        if (project && (role === 'superadmin' || project.organization_id === orgId)) {
            return { role: 'admin' }; // Synthetic membership
        }
    }
    return null;
};

// Helper to update organization storage usage
const updateOrganizationStorage = async (organizationId: number, sizeMb: number) => {
    try {
        await organizations.increment('storage_used_mb', {
            by: sizeMb,
            where: { id: organizationId }
        });
    } catch (err) {
        console.error("Error updating organization storage:", err);
    }
};

export const uploadFile = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { folder_id, project_id, skipActivity, location, tags } = req.body;
        const project = await projects.findByPk(project_id);

        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        // Check subscription status and storage limit
        const subscriptionCheck = await checkSubscriptionStatus(project.organization_id);
        if (!subscriptionCheck.allowed) {
            return res.status(subscriptionCheck.status).json({
                error: subscriptionCheck.message,
                code: (subscriptionCheck as any).code
            });
        }

        const fileSizeMb = (req as any).file.size / (1024 * 1024);
        const storageCheck = await checkStorageLimit(project.organization_id, fileSizeMb);
        if (!storageCheck.allowed) {
            return res.status(storageCheck.status).json({
                error: storageCheck.message,
                code: storageCheck.code
            });
        }

        const file_name = (req as any).file.originalname;
        const file_type = (req as any).file.mimetype;
        const file_size_mb = Math.max(1, Math.round((req as any).file.size / (1024 * 1024)));

        // Ensure contributors have access to this project
        if (authUser.role === "contributor" || authUser.role === "client") {
            const access = await checkProjectAccess(authUser.user_id, project_id, authUser.role, authUser.organization_id);
            if (!access) {
                return res.status(403).json({ error: "Forbidden: No access to this project" });
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
            try {
                // Ensure we have a sender name for the watermark
                let senderName = authUser.name;
                if (!senderName) {
                    const sender = await users.findByPk(authUser.user_id);
                    senderName = sender?.name || "Someone";
                }

                fileBuffer = await addWatermark(req.file.buffer, project.name, senderName);
                // Force extension to jpg since we are converting
                finalFileName = file_name.replace(/\.[^/.]+$/, "") + ".jpg";
            } catch (sharpErr) {
                console.error("Watermarking failed, falling back to original", sharpErr);
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
            location: location || null,
            tags: tags || null,
        });

        const isImage = file_type.startsWith('image/');
        const activityCategory = isImage ? 'photos' : 'documents';
        const notificationType = isImage ? 'photo_upload' : 'file_upload';

        // Check skipActivity explicitly
        const shouldSkip = skipActivity === 'true' || skipActivity === true;

        console.log("fileId", newFile.id)

        if (!shouldSkip) {
            // Log Activity
            await logActivity({
                projectId: parseInt(project_id, 10),
                userId: authUser.user_id,
                type: isImage ? 'upload_photo' : 'upload',
                description: `Uploaded ${finalFileName}`,
                metadata: { folderId: finalFolderId, fileId: newFile.id, type: activityCategory }
            });


            // Notify project members based on project membership
            const members = await project_members.findAll({
                where: {
                    project_id: parseInt(project_id, 10),
                    user_id: { [Op.ne]: authUser.user_id }
                },
                include: [{
                    model: UsersModel,
                    attributes: ['id', 'name']
                }]
            });

            // Fallback for name if missing from token
            let senderName = authUser.name;
            if (!senderName) {
                const sender = await users.findByPk(authUser.user_id);
                senderName = sender?.name || "Someone";
            }

            const notifiedUserIds = new Set<number>();
            for (const member of members) {
                notifiedUserIds.add(member.user_id);
                if (!shouldSkip) {
                    await sendNotification({
                        userId: member.user_id,
                        title: isImage ? 'New Photo Uploaded' : 'New File Uploaded',
                        body: `${senderName} uploaded ${finalFileName}`,
                        type: notificationType,
                        data: { fileId: String(newFile.id), projectId: String(project_id), folderId: String(finalFolderId), type: activityCategory }
                    });
                }
            }


            // Notify Admins in the organization
            try {
                const admins = await UsersModel.findAll({
                    where: {
                        organization_id: project.organization_id,
                        role: 'admin',
                        id: { [Op.notIn]: Array.from(notifiedUserIds).concat(authUser.user_id) }
                    }
                });

                const adminNotificationType = isImage ? 'photo_upload' : 'file_upload_admin';

                for (const adminUser of admins) {
                    if (!shouldSkip) {
                        await sendNotification({
                            userId: adminUser.id,
                            title: isImage ? 'New Photo Uploaded' : 'New File Uploaded',
                            body: `${senderName} uploaded ${finalFileName}`,
                            type: adminNotificationType,
                            data: { fileId: String(newFile.id), projectId: String(project_id), folderId: String(finalFolderId), type: activityCategory }
                        });
                    }
                }
            } catch (err) {
                console.error('Error notifying admins of new file upload:', err);
            }
        } // End of skip condition


        // Broadcast live stats update to all members viewing this project
        try {
            const io = getIO();
            io.to(`project-${project_id}`).emit('project-stats-updated', { projectId: String(project_id) });
        } catch (e) {
            console.error('Socket emit error (non-fatal):', e);
        }

        res.status(200).json({
            message: "File uploaded successfully",
            file: newFile
        });

        // Update organization storage usage
        await updateOrganizationStorage(project.organization_id, file_size_mb);
    } catch (error) {
        console.error("Upload File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const listFiles = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { projectId } = req.params;
        const { folder_type } = req.query;

        // Verify access
        const access = await checkProjectAccess(authUser.user_id, Number(projectId), authUser.role, authUser.organization_id);
        if (!access) {
            return res.status(403).json({ error: "Forbidden: No access to this project" });
        }

        // Get all folders for this project
        const folderWhere: any = { project_id: projectId };
        if (folder_type) {
            folderWhere[Op.or] = [
                { folder_type: folder_type },
                { folder_type: null }
            ];
        }

        const folderData = await folders.findAll({
            where: folderWhere,
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
    const t = await db.sequelize.transaction();
    try {
        const authUser = (req as any).user;
        const { fileId } = req.params;

        const file = await files.findByPk(fileId, { transaction: t });
        if (!file) {
            await t.rollback();
            return res.status(404).json({ error: "File not found" });
        }

        // ONLY the original uploader can delete individual files
        if (String(file.created_by) !== String(authUser.user_id)) {
            await t.rollback();
            return res.status(403).json({ error: "Unauthorized: only the original uploader can delete this file" });
        }

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.file_url
        });

        await s3Client.send(command);

        await logActivity({
            projectId: file.project_id,
            userId: authUser.user_id,
            type: 'delete',
            description: `Deleted ${file.file_name}`,
            metadata: { fileId: file.id, type: file.file_type?.startsWith('image/') ? 'photos' : 'documents' }
        });

        await file.destroy({ transaction: t });

        // Update organization storage usage (decrement)
        if (file.file_size_mb > 0) {
            await organizations.decrement('storage_used_mb', {
                by: file.file_size_mb,
                where: { id: authUser.organization_id },
                transaction: t
            });
        }

        await t.commit();
        res.status(200).json({ message: "File deleted successfully" });
    } catch (error) {
        await t.rollback();
        console.error("Delete File Error:", error);
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

        const { ids, folder_id, client_visible, do_not_follow } = req.body;

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
        if (client_visible !== undefined || do_not_follow !== undefined) {
            if (authUser.role !== "admin" && authUser.role !== "superadmin") {
                return res.status(403).json({ error: "Forbidden: Only Admins can toggle file visibility or 'Do Not Follow'" });
            }
        }

        const updateData: any = {};
        if (folder_id !== undefined) updateData.folder_id = (folder_id === '' || folder_id === 'root') ? null : folder_id;
        if (client_visible !== undefined) updateData.client_visible = client_visible;
        if (do_not_follow !== undefined) updateData.do_not_follow = do_not_follow;

        await files.update(updateData, {
            where: { id: ids }
        });

        // Activity logging (simplified)
        if (ids.length > 0) {
            const firstFile = await files.findByPk(ids[0]);
            if (firstFile) {
                await logActivity({
                    projectId: firstFile.project_id,
                    userId: authUser.user_id,
                    type: 'edit',
                    description: `Bulk updated ${ids.length} files`,
                    metadata: { type: firstFile.file_type?.startsWith('image/') ? 'photos' : 'documents' }
                });
            }
        }

        res.status(200).json({ message: "Files updated successfully" });
    } catch (error) {
        console.error("Bulk Update Files Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateFile = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { fileId } = req.params;
        const { file_name, folder_id, client_visible, do_not_follow } = req.body;

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Permission check: Admin, Superadmin, or Contributor only
        const isAuthorized = ['admin', 'superadmin', 'contributor'].includes(authUser.role);

        if (!isAuthorized) {
            return res.status(403).json({ error: "Forbidden: Only Admins and Contributors can update files" });
        }

        const previousVisibility = file.client_visible;
        const updateData: any = {};
        if (file_name !== undefined) updateData.file_name = file_name;
        if (folder_id !== undefined) updateData.folder_id = (folder_id === '' || folder_id === 'root') ? null : folder_id;
        if (client_visible !== undefined) updateData.client_visible = client_visible;
        if (do_not_follow !== undefined) updateData.do_not_follow = do_not_follow;

        await file.update(updateData);

        // If newly visible, notify clients
        if (client_visible === true && previousVisibility === false) {
            const project = await projects.findByPk(file.project_id);
            if (project) {
                const clients = await project_members.findAll({
                    where: { project_id: file.project_id, role: 'client' },
                    attributes: ['user_id']
                });

                for (const client of clients) {
                    await sendNotification({
                        userId: Number((client as any).user_id),
                        title: 'New File Available',
                        body: `A new file "${file.file_name}" is now visible to you.`,
                        type: 'file_visibility',
                        data: { fileId: String(file.id), projectId: String(file.project_id) }
                    });
                }
            }
        }

        await logActivity({
            projectId: file.project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Updated file: ${file.file_name}`,
            metadata: { fileId: file.id, updates: Object.keys(updateData), type: file.file_type?.startsWith('image/') ? 'photos' : 'documents' }
        });

        res.status(200).json({ message: "File updated successfully", file });
    } catch (error) {
        console.error("Update File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const uploadScans = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { project_id, folder_id, mode, file_name, location, tags, is_doc_mode } = req.body;
        const project = await projects.findByPk(project_id);
        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        // Check subscription status and storage limit
        const subscriptionCheck = await checkSubscriptionStatus(project.organization_id);
        if (!subscriptionCheck.allowed) {
            return res.status(subscriptionCheck.status).json({
                error: subscriptionCheck.message,
                code: (subscriptionCheck as any).code
            });
        }

        const scanFiles = (req as any).files as MulterFile[];
        const totalIncomingSizeMb = (scanFiles || []).reduce((acc, f) => acc + (f.size / (1024 * 1024)), 0);

        const storageCheck = await checkStorageLimit(project.organization_id, totalIncomingSizeMb);
        if (!storageCheck.allowed) {
            return res.status(storageCheck.status).json({
                error: storageCheck.message,
                code: storageCheck.code
            });
        }


        if (!scanFiles || !Array.isArray(scanFiles) || scanFiles.length === 0) {
            return res.status(400).json({ error: "No scan files uploaded" });
        }

        // Access check
        if (authUser.role === "contributor") {
            const access = await checkProjectAccess(authUser.user_id, project_id, authUser.role, authUser.organization_id);
            if (!access || access.role !== "contributor") {
                return res.status(403).json({ error: "Forbidden: Not a contributor to this project" });
            }
        }

        // Get sender name for watermark and notifications
        let senderName = authUser.name;
        if (!senderName) {
            const sender = await users.findByPk(authUser.user_id);
            senderName = sender?.name || "Someone";
        }

        const validFolderId = (folder_id !== undefined && folder_id !== null && folder_id !== 'undefined' && folder_id !== '') ? parseInt(folder_id, 10) : null;
        const folderPath = validFolderId ? validFolderId.toString() : 'root';
        const isSeparate = mode === 'separate';
        const shouldSkip = req.body.skipActivity === 'true' || req.body.skipActivity === true;

        const createdFiles = [];
        
        // We only merge if mode is 'single' AND there's more than 1 file.
        // If there's only 1 file, we ALWAYS "just save" it to preserve integrity.
        const shouldMerge = !isSeparate && scanFiles.length > 1;

        console.log(`[DEBUG] uploadScans Start: mode=${mode}, files=${scanFiles.length}, shouldMerge=${shouldMerge}`);

        if (!shouldMerge) {
            // mode === 'separate' or a single file -> preserve original files/names
            for (let i = 0; i < scanFiles.length; i++) {
                const file = scanFiles[i];
                console.log(`[DEBUG] Processing file ${i}: name=${file.originalname}, mimetype=${file.mimetype}`);
                
                let uploadBuffer: Buffer = file.buffer;
                const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
                const isImage = file.mimetype.startsWith('image/');
                
                const originalName = file.originalname;
                let finalFileName = originalName;
                let finalMimeType = file.mimetype;
                let extension = '.pdf';

                const extMatch = originalName.match(/\.[0-9a-z]+$/i);
                if (extMatch) {
                    extension = extMatch[0].toLowerCase();
                }

                // CASE 1: It's an image and we're in doc mode -> Convert to PDF
                if (isImage && (is_doc_mode === 'true' || is_doc_mode === true)) {
                    console.log(`[DEBUG] Converting image to PDF: ${originalName}`);
                    try {
                        const pdfDoc = await PDFDocument.create();
                        let imageBuffer = file.buffer;

                        // 1. Always use sharp to normalize to JPEG first (fixes HEIC/PNG issues)
                        try {
                            imageBuffer = await addWatermark(file.buffer, project.name, senderName);
                            imageBuffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer();
                        } catch (watermarkErr) {
                            imageBuffer = await sharp(file.buffer).jpeg({ quality: 85 }).toBuffer();
                        }

                        // 2. Embed the normalized JPEG
                        const image = await pdfDoc.embedJpg(imageBuffer);
                        const page = pdfDoc.addPage([image.width, image.height]);
                        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                        
                        const pdfBytes = await pdfDoc.save();
                        uploadBuffer = Buffer.from(pdfBytes);
                        
                        // Use requested naming convention
                        finalFileName = (file_name || `Scan_${Date.now()}`) + ".pdf";
                        finalMimeType = 'application/pdf';
                        extension = '.pdf';
                    } catch (err) {
                        console.error("Image to PDF conversion failed:", err);
                        // Fallback to original image if conversion fails
                        uploadBuffer = file.buffer;
                        finalFileName = originalName;
                        extension = extMatch ? extMatch[0] : '.jpg';
                    }
                } 
                // CASE 2: It's already a PDF -> JUST SAVE (Preserve everything)
                else if (isPdf) {
                    console.log(`[DEBUG] Preserving original PDF: ${originalName}`);
                    uploadBuffer = file.buffer;
                    finalFileName = originalName;
                    finalMimeType = 'application/pdf';
                    extension = '.pdf';
                }
                // CASE 3: Other files (photos in photo mode)
                else {
                    uploadBuffer = file.buffer;
                    finalFileName = originalName;
                    finalMimeType = file.mimetype;
                }

                const s3Key = `projects/${project_id}/folders/${folderPath}/${Date.now()}_${i}${extension}`;

                await s3Client.send(new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key,
                    ContentType: finalMimeType,
                    ContentDisposition: 'inline',
                    Body: uploadBuffer
                }));

                const newFile = await files.create({
                    folder_id: validFolderId,
                    project_id: parseInt(project_id, 10),
                    file_url: s3Key,
                    file_name: finalFileName,
                    client_visible: true,
                    file_type: finalMimeType,
                    file_size_mb: Math.max(1, Math.round(uploadBuffer.length / (1024 * 1024))),
                    created_by: authUser.user_id,
                    location: location || null,
                    tags: tags || null,
                });

                createdFiles.push(newFile);

                if (!shouldSkip) {
                    await logActivity({
                        projectId: parseInt(project_id, 10),
                        userId: authUser.user_id,
                        type: (is_doc_mode === 'true' || is_doc_mode === true) ? 'upload' : 'upload_photo',
                        description: `Uploaded: ${finalFileName}`,
                        metadata: { folderId: validFolderId, fileId: newFile.id, type: (is_doc_mode === 'true' || is_doc_mode === true) ? 'documents' : 'photos' }
                    });
                }
            }
        } else {
            // mode === 'single' and multiple files -> merge all into one PDF
            console.log(`[DEBUG] Merging ${scanFiles.length} files into single PDF`);
            const pdfDoc = await PDFDocument.create();
            let pagesAdded = 0;

            for (const file of scanFiles) {
                const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
                
                if (isPdf) {
                    try {
                        const srcDoc = await PDFDocument.load(file.buffer);
                        const copiedPages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
                        copiedPages.forEach((page) => {
                            pdfDoc.addPage(page);
                            pagesAdded++;
                        });
                    } catch (pdfErr) {
                        console.error(`Failed to load PDF for merging:`, pdfErr);
                    }
                } else if (file.mimetype.startsWith('image/')) {
                    try {
                        let imageBuffer = file.buffer;
                        try {
                            imageBuffer = await addWatermark(file.buffer, project.name, senderName);
                            imageBuffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer();
                        } catch (e) {
                            imageBuffer = await sharp(file.buffer).jpeg({ quality: 85 }).toBuffer();
                        }

                        const image = await pdfDoc.embedJpg(imageBuffer);
                        const page = pdfDoc.addPage([image.width, image.height]);
                        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                        pagesAdded++;
                    } catch (imgErr) {
                        console.error("Failed to embed image in merge:", imgErr);
                    }
                }
            }

            if (pagesAdded > 0) {
                const pdfBytes = await pdfDoc.save();
                const uploadBuffer = Buffer.from(pdfBytes);
                
                // Use requested naming convention
                const finalFileName = (file_name || `Scan_${Date.now()}`) + ".pdf";
                const s3Key = `projects/${project_id}/folders/${folderPath}/${Date.now()}.pdf`;

                await s3Client.send(new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key,
                    ContentType: 'application/pdf',
                    ContentDisposition: 'inline',
                    Body: uploadBuffer
                }));

                const newFile = await files.create({
                    folder_id: validFolderId,
                    project_id: parseInt(project_id, 10),
                    file_url: s3Key,
                    file_name: finalFileName,
                    client_visible: true,
                    file_type: 'application/pdf',
                    file_size_mb: Math.max(1, Math.round(uploadBuffer.length / (1024 * 1024))),
                    created_by: authUser.user_id,
                    location: location || null,
                    tags: tags || null,
                });

                createdFiles.push(newFile);

                if (!shouldSkip) {
                    await logActivity({
                        projectId: parseInt(project_id, 10),
                        userId: authUser.user_id,
                        type: (is_doc_mode === 'true' || is_doc_mode === true) ? 'upload' : 'upload_photo',
                        description: `Uploaded merged file: ${finalFileName}`,
                        metadata: { folderId: validFolderId, fileId: newFile.id, type: (is_doc_mode === 'true' || is_doc_mode === true) ? 'documents' : 'photos' }
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            message: createdFiles.length > 0 ? "Files uploaded successfully" : "No files were processed",
            files: createdFiles,
            file: createdFiles[0] || null
        });

        // Update organization storage usage
        if (createdFiles.length > 0) {
            const totalFilesSizeMb = createdFiles.reduce((acc, f) => acc + (f.file_size_mb || 0), 0);
            await updateOrganizationStorage(project.organization_id, totalFilesSizeMb);
        }

        // Notifications logic...
        try {
            if (createdFiles.length === 0) return;
            const members = await project_members.findAll({
                where: { project_id: parseInt(project_id, 10), user_id: { [Op.ne]: authUser.user_id } },
                include: [{ model: UsersModel, attributes: ['id', 'name'] }]
            });

            const scanType = (is_doc_mode === 'true' || is_doc_mode === true) ? "documents" : "photos";
            const fileCount = createdFiles.length;
            const notificationTitle = (is_doc_mode === 'true' || is_doc_mode === true) ? "New Documents Uploaded" : "New Photos Uploaded";
            const notificationBody = `${senderName} uploaded ${fileCount} ${scanType}`;

            for (const member of members) {
                if (!shouldSkip) {
                    await sendNotification({
                        userId: member.user_id,
                        title: notificationTitle,
                        body: notificationBody,
                        type: (is_doc_mode === 'true' || is_doc_mode === true) ? 'file_upload' : 'photo_upload',
                        data: { projectId: String(project_id), folderId: String(validFolderId), type: (is_doc_mode === 'true' || is_doc_mode === true) ? 'documents' : 'photos' }
                    });
                }
            }

            const orgAdmins = await users.findAll({
                where: { organization_id: project.organization_id, role: 'admin', id: { [Op.ne]: authUser.user_id } }
            });

            for (const admin of orgAdmins) {
                if (members.some((m: any) => m.user_id === admin.id)) continue;
                if (!shouldSkip) {
                    await sendNotification({
                        userId: admin.id,
                        title: notificationTitle,
                        body: notificationBody,
                        type: (is_doc_mode === 'true' || is_doc_mode === true) ? 'file_upload' : 'photo_upload',
                        data: { projectId: String(project_id), folderId: String(validFolderId), type: (is_doc_mode === 'true' || is_doc_mode === true) ? 'documents' : 'photos' }
                    });
                }
            }
        } catch (notifErr) {
            console.error("Notification Error:", notifErr);
        }


    } catch (error) {
        console.error("Upload Scans Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const archiveFile = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { fileId } = req.params;

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Permission check: Admin, Superadmin, or Project Contributor
        const authId = authUser.user_id || authUser.id;
        let isAuthorized = ['admin', 'superadmin'].includes(authUser.role) || Number(file.created_by) === Number(authId);

        if (!isAuthorized && authUser.role === 'contributor') {
            const membership = await checkProjectAccess(Number(authId), file.project_id, authUser.role, authUser.organization_id);
            if (membership) isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: "Forbidden: Only Admins or project contributors can archive this file" });
        }

        // 1. Find or create the "Archive" folder for this project
        let archiveFolder = await folders.findOne({
            where: {
                project_id: file.project_id,
                name: { [Op.iLike]: 'Archive' },
                folder_type: 'document',
                parent_id: null
            }
        });

        if (!archiveFolder) {
            archiveFolder = await folders.create({
                project_id: file.project_id,
                name: "Archive",
                client_visible: false, // Internal by default
                parent_id: null,
                created_by: authUser.user_id,
                folder_type: 'document'
            });
        }

        // 2. Update file: move to archive folder and set do_not_follow = true
        const oldFileName = file.file_name;
        file.folder_id = archiveFolder.id;
        file.do_not_follow = true;
        await file.save();

        await logActivity({
            projectId: file.project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Archived document "${oldFileName}" (Set to Do Not Follow)`,
            metadata: { fileId: file.id, folderId: archiveFolder.id, type: 'documents' }
        });

        res.status(200).json({
            message: "File archived successfully",
            file,
            archiveFolder
        });

    } catch (error) {
        console.error("Archive File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const unarchiveFile = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { fileId } = req.params;
        const { folder_id } = req.body;

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Permission check: Admin, Superadmin, or Project Contributor
        const authId = authUser.user_id || authUser.id;
        let isAuthorized = ['admin', 'superadmin'].includes(authUser.role) || Number(file.created_by) === Number(authId);

        if (!isAuthorized && authUser.role === 'contributor') {
            const membership = await checkProjectAccess(Number(authId), file.project_id, authUser.role, authUser.organization_id);
            if (membership) isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: "Forbidden: Only Admins or project contributors can unarchive this file" });
        }

        const oldFileName = file.file_name;

        // 1. Update file: move to target folder and reset do_not_follow = false
        file.folder_id = (folder_id === '' || folder_id === 'root' || folder_id === null) ? null : folder_id;
        file.do_not_follow = false;
        await file.save({ fields: ['folder_id', 'do_not_follow'] });

        let targetFolderName = "Root";
        if (file.folder_id) {
            const targetFolder = await folders.findByPk(file.folder_id);
            if (targetFolder) targetFolderName = targetFolder.name;
        }

        await logActivity({
            projectId: file.project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Unarchived document "${oldFileName}" to ${targetFolderName}`,
            metadata: { fileId: file.id, folderId: file.folder_id, type: 'documents' }
        });

        res.status(200).json({
            message: "File unarchived successfully",
            file
        });

    } catch (error) {
        console.error("Unarchive File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
