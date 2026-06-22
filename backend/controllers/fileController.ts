import type { Request, Response } from "express";
import 'multer';
import db from "../models/index.ts";
const { files, folders, project_members, activities, users, organizations, projects, file_links, file_rfi_links, file_snag_links, project_member_folders } = db;

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
import { addWatermarksToPDF } from "../utils/pdfWatermark.ts";

interface MulterFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

const parseAssignedTo = (assigned_to: any): number[] => {
    let assignedToArray: number[] = [];
    if (assigned_to) {
        if (Array.isArray(assigned_to)) {
            assignedToArray = assigned_to.map((id: any) => parseInt(id, 10)).filter(id => !isNaN(id));
        } else if (typeof assigned_to === 'string') {
            const trimmed = assigned_to.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    assignedToArray = JSON.parse(trimmed).map((id: any) => parseInt(id, 10)).filter((id: any) => !isNaN(id));
                } catch (e) {
                    assignedToArray = trimmed.split(',').map((id: any) => parseInt(id.trim(), 10)).filter((id: any) => !isNaN(id));
                }
            } else if (trimmed) {
                assignedToArray = trimmed.split(',').map((id: any) => parseInt(id.trim(), 10)).filter((id: any) => !isNaN(id));
            }
        } else if (typeof assigned_to === 'number') {
            assignedToArray = [assigned_to];
        }
    }
    return assignedToArray;
};

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

export const confirmScreenshot = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { project_id, skipActivity, location, tags, assigned_to } = req.body;

        if (!project_id || project_id === '') {
            return res.status(400).json({ error: "Project ID is required for confirmation screenshots" });
        }

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

        // Find or create "Confirmations" folder
        let folder = await folders.findOne({
            where: {
                project_id,
                name: { [Op.iLike]: 'Confirmations' },
                folder_type: 'photo'
            }
        });

        if (!folder) {
            folder = await folders.create({
                project_id,
                name: 'Confirmations',
                client_visible: true,
                folder_type: 'photo',
                created_by: authUser.user_id
            });

            await logActivity({
                projectId: project_id,
                userId: authUser.user_id,
                type: 'edit',
                description: `Created folder "Confirmations"`,
                metadata: { folderId: folder.id, type: 'photos' }
            });
        }

        const finalFolderId = folder.id;
        const file_name = (req as any).file.originalname;
        const file_type = (req as any).file.mimetype;
        const file_size_mb = Math.max(1, Math.round((req as any).file.size / (1024 * 1024)));

        const s3Key = `projects/${project_id}/folders/${finalFolderId}/${Date.now()}.jpg`;

        let fileBuffer = req.file.buffer;
        let finalFileName = file_name;

        // Apply compression and watermarking to screenshots (which are images)
        try {
            let senderName = authUser.name;
            if (!senderName) {
                const sender = await users.findByPk(authUser.user_id);
                senderName = sender?.name || "Someone";
            }

            fileBuffer = await addWatermark(req.file.buffer, project.name, senderName);
            finalFileName = file_name.replace(/\.[^/.]+$/, "") + ".jpg";
        } catch (sharpErr) {
            console.error("Watermarking failed, falling back to original", sharpErr);
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
            assigned_to: assigned_to ? parseAssignedTo(assigned_to) : null,
        });

        // Log Activity
        if (skipActivity !== 'true' && skipActivity !== true) {
            await logActivity({
                projectId: parseInt(project_id, 10),
                userId: authUser.user_id,
                type: 'upload_photo',
                description: `Uploaded confirmation screenshot: ${finalFileName}`,
                metadata: { folderId: finalFolderId, fileId: newFile.id, type: 'photos' }
            });
        }

        // Broadcast live stats update
        try {
            const io = getIO();
            io.to(`project-${project_id}`).emit('project-stats-updated', { projectId: String(project_id) });
        } catch (e) {
            console.error('Socket emit error (non-fatal):', e);
        }

        res.status(200).json({
            message: "Confirmation screenshot uploaded successfully",
            file: newFile,
            folder: folder
        });

        await updateOrganizationStorage(project.organization_id, file_size_mb);
    } catch (error) {
        console.error("Confirm Screenshot Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const uploadFile = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { folder_id, project_id, skipActivity, location, tags, assigned_to, parent_file_id } = req.body;
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

        // Ensure contributors/clients/consultants/vendors have access to this project
        const isProjectUser = ["contributor", "client", "consultant", "vendor"].includes(authUser.role);
        let access: any = null;
        if (isProjectUser) {
            access = await checkProjectAccess(authUser.user_id, project_id, authUser.role, authUser.organization_id);
            if (!access) {
                return res.status(403).json({ error: "Forbidden: No access to this project" });
            }
        }

        const validFolderId = (folder_id !== undefined && folder_id !== null && folder_id !== 'undefined' && folder_id !== '') ? parseInt(folder_id, 10) : null;
        let finalFolderId = validFolderId;

        if (finalFolderId) {
            const targetFolder = await folders.findByPk(finalFolderId);
            if (targetFolder && targetFolder.name.toLowerCase() === 'confidential') {
                if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                    return res.status(403).json({ error: "Forbidden: You do not have access to this folder" });
                }
            }
        }

        // Restriction: Consultant/Vendor can only upload to allowed folders, not root
        if (authUser.role === "consultant" || authUser.role === "vendor") {
            if (!finalFolderId) {
                return res.status(403).json({ error: "Forbidden: Cannot upload to root folder" });
            }
            const { project_member_folders } = await import("../models/index.ts");
            const isAllowed = await project_member_folders.findOne({
                where: { project_member_id: access.id, folder_id: finalFolderId }
            });
            if (!isAllowed) {
                return res.status(403).json({ error: "Forbidden: You do not have access to this folder" });
            }
        }

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

        const assignedToArray = assigned_to ? parseAssignedTo(assigned_to) : [];

        let rootParentId: number | null = null;
        if (parent_file_id && parent_file_id !== 'null' && parent_file_id !== 'undefined' && parent_file_id !== '') {
            const parentFile = await files.findByPk(parseInt(parent_file_id, 10));
            if (parentFile) {
                rootParentId = parentFile.parent_file_id || parentFile.id;
            }
        }

        if (rootParentId) {
            await files.update(
                { is_current: false },
                {
                    where: {
                        [Op.or]: [
                            { id: rootParentId },
                            { parent_file_id: rootParentId }
                        ]
                    }
                }
            );
        }

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
            assigned_to: assignedToArray.length > 0 ? assignedToArray : null,
            parent_file_id: rootParentId,
            is_current: true
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

            // Get allowed folders for consultants/vendors in this project
            const allowedMemberFolders = await project_member_folders.findAll({
                where: {
                    folder_id: finalFolderId || -1
                }
            });
            const allowedMemberIds = new Set(allowedMemberFolders.map((amf: any) => amf.project_member_id));

            // Fallback for name if missing from token
            let senderName = authUser.name;
            if (!senderName) {
                const sender = await users.findByPk(authUser.user_id);
                senderName = sender?.name || "Someone";
            }

            const notifiedUserIds = new Set<number>();
            for (const member of members) {
                if (member.role === 'consultant' || member.role === 'vendor') {
                    if (!allowedMemberIds.has(member.id)) {
                        continue; // Skip notification for restricted folders
                    }
                }
                notifiedUserIds.add(member.user_id);
                if (!shouldSkip) {
                    const isAssignee = assignedToArray.includes(member.user_id);
                    await sendNotification({
                        userId: member.user_id,
                        title: isAssignee ? 'New File Assigned to You' : (isImage ? 'New Photo Uploaded' : 'New File Uploaded'),
                        body: isAssignee ? `Project Document Assigned: ${senderName} assigned a new file to you: ${finalFileName}` : `${senderName} uploaded ${finalFileName}`,
                        type: isAssignee ? 'file_assigned' : notificationType,
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
        const { folder_type, search } = req.query;

        // Verify access
        const access = await checkProjectAccess(authUser.user_id, Number(projectId), authUser.role, authUser.organization_id);
        if (!access) {
            return res.status(403).json({ error: "Forbidden: No access to this project" });
        }

        // Auto-create Confidential folders if missing for existing projects
        const project_id = Number(projectId);
        const typesToCheck = folder_type ? [folder_type as string] : ['photo', 'document'];
        for (const type of typesToCheck) {
            const confidentialExists = await folders.findOne({
                where: {
                    project_id,
                    name: { [Op.iLike]: 'Confidential' },
                    folder_type: type
                }
            });
            if (!confidentialExists) {
                try {
                    await folders.create({
                        project_id,
                        name: 'Confidential',
                        client_visible: false,
                        created_by: authUser?.user_id,
                        folder_type: type
                    });
                } catch (err) {
                    console.error(`Error auto-creating Confidential folder:`, err);
                }
            }
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

        let filteredFolders = folderData.map((f: any) => f.toJSON());
        if (authUser.role === "client") {
            // Remove hidden folders
            filteredFolders = filteredFolders.filter((folder: any) => folder.client_visible !== false);
        } else if (authUser.role === "consultant" || authUser.role === "vendor") {
            const allowedFolders = await project_member_folders.findAll({
                where: { project_member_id: access.id },
                attributes: ['folder_id']
            });
            const allowedFolderIds = allowedFolders.map((af: any) => af.folder_id);
            filteredFolders = filteredFolders.filter((folder: any) => allowedFolderIds.includes(folder.id));
        }

        if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
            filteredFolders = filteredFolders.filter((folder: any) => folder.name.toLowerCase() !== 'confidential');
        }

        const allowedFolderIdsForFiles = filteredFolders.map((f: any) => f.id);
        const isRestrictedRole = authUser.role === "consultant" || authUser.role === "vendor";

        // Get all files for this project (either by explicit project_id or via folder_id)
        const fileData = await files.findAll({
            where: {
                [Op.and]: [
                    isRestrictedRole
                        ? { folder_id: { [Op.in]: allowedFolderIdsForFiles } }
                        : {
                            [Op.or]: [
                                { project_id: projectId },
                                { folder_id: { [Op.in]: folderIds } }
                            ]
                        },
                    { is_current: true },
                    search ? { file_name: { [Op.iLike]: `%${search}%` } } : {}
                ].filter(Boolean) as any
            },
            include: [
                {
                    model: UsersModel,
                    as: 'creator',
                    attributes: ['id', 'name', 'email']
                }
            ]
        });

        let filteredFiles = fileData.map((f: any) => f.toJSON());

        // Retrieve and populate assignees array and backwards-compatible assignee object
        const allAssigneeIds = Array.from(
            new Set(
                filteredFiles.flatMap((f: any) => f.assigned_to || [])
            )
        );
        const allAssignees = allAssigneeIds.length > 0
            ? await UsersModel.findAll({
                where: { id: { [Op.in]: allAssigneeIds } },
                attributes: ['id', 'name', 'email']
            })
            : [];
        const assigneeMap = new Map(allAssignees.map((u: any) => [u.id, u.toJSON()]));

        for (const file of filteredFiles) {
            const fileAssignees = (file.assigned_to || [])
                .map((id: number) => assigneeMap.get(id))
                .filter(Boolean);
            file.assignees = fileAssignees;
            file.assignee = fileAssignees[0] || null;
        }

        if (authUser.role !== "admin" && authUser.role !== "superadmin") {
            const confidentialFolderIds = folderData.filter((f: any) => f.name.toLowerCase() === 'confidential').map((f: any) => f.id);
            filteredFiles = filteredFiles.filter((file: any) => !confidentialFolderIds.includes(file.folder_id));
        }

        if (authUser.role === "client") {
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

        // 0. Protection: Cannot delete files in protected folders (Confirmations, Archive)
        if (file.folder_id) {
            const folder = await folders.findByPk(file.folder_id, { transaction: t });
            if (folder) {
                const folderNameLower = folder.name.toLowerCase();
                if (
                    (folder.folder_type === 'photo' && (folderNameLower === 'confirmation' || folderNameLower === 'confirmations' || folderNameLower === 'archive')) ||
                    (folder.folder_type === 'document' && folderNameLower === 'archive')
                ) {
                    await t.rollback();
                    return res.status(403).json({ error: "Forbidden: Files in system folders cannot be deleted" });
                }
                if (folderNameLower === 'confidential') {
                    if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                        await t.rollback();
                        return res.status(403).json({ error: "Forbidden: Only Admins can delete files in a confidential folder" });
                    }
                }
            }
        }

        // ONLY the original uploader can delete individual files
        if (String(file.created_by) !== String(authUser.user_id)) {
            await t.rollback();
            return res.status(403).json({ error: "Unauthorized: only the original uploader can delete this file" });
        }

        await logActivity({
            projectId: file.project_id,
            userId: authUser.user_id,
            type: 'delete',
            description: `Moved ${file.file_name} to trash`,
            metadata: { fileId: file.id, type: file.file_type?.startsWith('image/') ? 'photos' : 'documents' }
        });

        await file_links.destroy({
            where: {
                [Op.or]: [
                    { file_id_1: fileId },
                    { file_id_2: fileId }
                ]
            },
            transaction: t
        });
        await file_rfi_links.destroy({
            where: { file_id: fileId },
            transaction: t
        });
        await file_snag_links.destroy({
            where: { file_id: fileId },
            transaction: t
        });

        // Version fallback and promotion logic
        const deletedIds = [file.id];
        const rootId = file.parent_file_id || file.id;
        const wasCurrent = file.is_current;

        const otherVersions = await files.findAll({
            where: {
                id: { [Op.notIn]: deletedIds },
                [Op.or]: [
                    { id: rootId },
                    { parent_file_id: rootId }
                ]
            },
            order: [['createdAt', 'DESC']],
            transaction: t
        });

        if (otherVersions.length > 0) {
            if (file.id === rootId) {
                const newRoot = otherVersions[otherVersions.length - 1];
                await newRoot.update({ parent_file_id: null }, { transaction: t });
                const otherVersionIds = otherVersions
                    .filter(v => v.id !== newRoot.id)
                    .map(v => v.id);

                if (otherVersionIds.length > 0) {
                    await files.update(
                        { parent_file_id: newRoot.id },
                        {
                            where: { id: { [Op.in]: otherVersionIds } },
                            transaction: t
                        }
                    );
                }

                if (wasCurrent) {
                    await files.update(
                        { is_current: true },
                        {
                            where: { id: otherVersions[0].id },
                            transaction: t
                        }
                    );
                }
            } else {
                if (wasCurrent) {
                    await files.update(
                        { is_current: true },
                        {
                            where: { id: otherVersions[0].id },
                            transaction: t
                        }
                    );
                }
            }
        }

        await file.destroy({ transaction: t });

        await t.commit();
        res.status(200).json({ message: "File moved to trash successfully" });
    } catch (error) {
        await t.rollback();
        console.error("Delete File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const bulkDeleteFiles = async (req: Request, res: Response) => {
    const t = await db.sequelize.transaction();
    try {
        const authUser = (req as any).user;
        if (!authUser) {
            await t.rollback();
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            await t.rollback();
            return res.status(400).json({ error: "No file IDs provided" });
        }

        const fileRecords = await files.findAll({
            where: { id: ids },
            transaction: t
        });

        if (fileRecords.length === 0) {
            await t.rollback();
            return res.status(404).json({ error: "No files found to delete" });
        }

        // Validate each file
        for (const file of fileRecords) {
            // Protection: Cannot delete files in protected folders (Confirmations, Archive)
            if (file.folder_id) {
                const folder = await folders.findByPk(file.folder_id, { transaction: t });
                if (folder) {
                    const folderNameLower = folder.name.toLowerCase();
                    if (
                        (folder.folder_type === 'photo' && (folderNameLower === 'confirmation' || folderNameLower === 'confirmations' || folderNameLower === 'archive')) ||
                        (folder.folder_type === 'document' && folderNameLower === 'archive')
                    ) {
                        await t.rollback();
                        return res.status(403).json({ error: `Forbidden: File "${file.file_name}" is in a system folder and cannot be deleted` });
                    }
                    if (folderNameLower === 'confidential') {
                        if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                            await t.rollback();
                            return res.status(403).json({ error: `Forbidden: Only Admins can delete files in a confidential folder` });
                        }
                    }
                }
            }

            // ONLY the original uploader can delete
            if (String(file.created_by) !== String(authUser.user_id)) {
                await t.rollback();
                return res.status(403).json({ error: `Unauthorized: Only the original uploader can delete file "${file.file_name}"` });
            }
        }

        // Log activities and delete
        for (const file of fileRecords) {
            await logActivity({
                projectId: file.project_id,
                userId: authUser.user_id,
                type: 'delete',
                description: `Moved ${file.file_name} to trash`,
                metadata: { fileId: file.id, type: file.file_type?.startsWith('image/') ? 'photos' : 'documents' }
            });

            await file_links.destroy({
                where: {
                    [Op.or]: [
                        { file_id_1: file.id },
                        { file_id_2: file.id }
                    ]
                },
                transaction: t
            });
            await file_rfi_links.destroy({
                where: { file_id: file.id },
                transaction: t
            });
            await file_snag_links.destroy({
                where: { file_id: file.id },
                transaction: t
            });

            // Version fallback and promotion logic for each file in bulk delete
            const rootId = file.parent_file_id || file.id;
            const wasCurrent = file.is_current;

            const otherVersions = await files.findAll({
                where: {
                    id: { [Op.notIn]: ids },
                    [Op.or]: [
                        { id: rootId },
                        { parent_file_id: rootId }
                    ]
                },
                order: [['createdAt', 'DESC']],
                transaction: t
            });

            if (otherVersions.length > 0) {
                if (file.id === rootId) {
                    const newRoot = otherVersions[otherVersions.length - 1];
                    await newRoot.update({ parent_file_id: null }, { transaction: t });
                    const otherVersionIds = otherVersions
                        .filter(v => v.id !== newRoot.id)
                        .map(v => v.id);

                    if (otherVersionIds.length > 0) {
                        await files.update(
                            { parent_file_id: newRoot.id },
                            {
                                where: { id: { [Op.in]: otherVersionIds } },
                                transaction: t
                            }
                        );
                    }

                    if (wasCurrent) {
                        await files.update(
                            { is_current: true },
                            {
                                where: { id: otherVersions[0].id },
                                transaction: t
                            }
                        );
                    }
                } else {
                    if (wasCurrent) {
                        await files.update(
                            { is_current: true },
                            {
                                where: { id: otherVersions[0].id },
                                transaction: t
                            }
                        );
                    }
                }
            }

            await file.destroy({ transaction: t });
        }

        await t.commit();
        res.status(200).json({ message: "Files moved to trash successfully" });
    } catch (error) {
        await t.rollback();
        console.error("Bulk Delete Files Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};



export const viewFile = async (req: Request, res: Response) => {
    try {
        const { fileKey } = req.body;
        if (!fileKey) {
            return res.status(400).json({ error: "No file key provided" });
        }

        const authUser = (req as any).user;
        const fileRecord = await files.findOne({ where: { file_url: fileKey } });
        if (fileRecord && fileRecord.folder_id) {
            const folder = await folders.findByPk(fileRecord.folder_id);
            if (folder && folder.name.toLowerCase() === 'confidential') {
                if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
                    return res.status(403).json({ error: "Forbidden: You do not have access to this confidential file" });
                }
            }
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

export const downloadFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const file = await files.findByPk(fileId);

        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        const authUser = (req as any).user;
        if (file.folder_id) {
            const folder = await folders.findByPk(file.folder_id);
            if (folder && folder.name.toLowerCase() === 'confidential') {
                if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
                    return res.status(403).json({ error: "Forbidden: You do not have access to this confidential file" });
                }
            }
        }

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.file_url,
        });

        const s3Item = await s3Client.send(command);

        if (!s3Item.Body) {
            return res.status(404).json({ error: "File content not found" });
        }

        // Convert S3 body to buffer
        const chunks: any[] = [];
        if (typeof (s3Item.Body as any).pipe === "function") {
            for await (const chunk of s3Item.Body as any) {
                chunks.push(chunk);
            }
        } else if (typeof (s3Item.Body as any).transformToByteArray === "function") {
            const bytes = await (s3Item.Body as any).transformToByteArray();
            chunks.push(Buffer.from(bytes));
        }

        let fileBuffer = Buffer.concat(chunks);

        // Apply watermark if needed
        if ((file.do_not_follow || file.only_for_reference) && file.file_type === 'application/pdf') {
            fileBuffer = await addWatermarksToPDF(fileBuffer, {
                doNotFollow: file.do_not_follow,
                onlyForReference: file.only_for_reference
            }) as any;
        }

        res.setHeader("Content-Type", file.file_type || "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${file.file_name}"`);
        res.send(fileBuffer);

    } catch (error) {
        console.error("Download File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const bulkUpdateFiles = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { ids, folder_id, client_visible, do_not_follow, only_for_reference } = req.body;

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
        if (client_visible !== undefined || do_not_follow !== undefined || only_for_reference !== undefined) {
            if (authUser.role !== "admin" && authUser.role !== "superadmin") {
                return res.status(403).json({ error: "Forbidden: Only Admins can toggle file visibility or 'Do Not Follow'" });
            }
        }

        const updateData: any = {};
        if (folder_id !== undefined) updateData.folder_id = (folder_id === '' || folder_id === 'root') ? null : folder_id;
        if (client_visible !== undefined) updateData.client_visible = client_visible;
        if (do_not_follow !== undefined) updateData.do_not_follow = do_not_follow;
        if (only_for_reference !== undefined) updateData.only_for_reference = only_for_reference;

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
        const { file_name, folder_id, client_visible, do_not_follow, only_for_reference } = req.body;

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Permission check: Admin, Superadmin, or Contributor only
        const isAuthorized = ['admin', 'superadmin', 'contributor'].includes(authUser.role);

        if (!isAuthorized) {
            return res.status(403).json({ error: "Forbidden: Only Admins and Contributors can update files" });
        }

        // Restriction: Only Admins/Superadmins can update or move files that are in a confidential folder
        if (file.folder_id) {
            const currentFolder = await folders.findByPk(file.folder_id);
            if (currentFolder && currentFolder.name.toLowerCase() === 'confidential') {
                if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                    return res.status(403).json({ error: "Forbidden: Only Admins can modify files in a confidential folder" });
                }
            }
        }

        // Restriction: Only Admins/Superadmins can move files into a confidential folder
        const targetFolderId = (folder_id === '' || folder_id === 'root') ? null : folder_id;
        if (targetFolderId) {
            const targetFolder = await folders.findByPk(targetFolderId);
            if (targetFolder && targetFolder.name.toLowerCase() === 'confidential') {
                if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                    return res.status(403).json({ error: "Forbidden: Only Admins can move files into a confidential folder" });
                }
            }
        }

        const previousVisibility = file.client_visible;
        const updateData: any = {};
        if (file_name !== undefined) updateData.file_name = file_name;
        if (folder_id !== undefined) updateData.folder_id = (folder_id === '' || folder_id === 'root') ? null : folder_id;
        if (client_visible !== undefined) updateData.client_visible = client_visible;
        if (do_not_follow !== undefined) updateData.do_not_follow = do_not_follow;
        if (only_for_reference !== undefined) updateData.only_for_reference = only_for_reference;

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

        const { project_id, folder_id, mode, file_name, location, tags, is_doc_mode, assigned_to, parent_file_id } = req.body;
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
        if (validFolderId) {
            const targetFolder = await folders.findByPk(validFolderId);
            if (targetFolder && targetFolder.name.toLowerCase() === 'confidential') {
                if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                    return res.status(403).json({ error: "Forbidden: You do not have access to this folder" });
                }
            }
        }
        const folderPath = validFolderId ? validFolderId.toString() : 'root';
        const isSeparate = mode === 'separate';
        const shouldSkip = req.body.skipActivity === 'true' || req.body.skipActivity === true;

        let rootParentId: number | null = null;
        if (parent_file_id && parent_file_id !== 'null' && parent_file_id !== 'undefined' && parent_file_id !== '') {
            const parentFile = await files.findByPk(parseInt(parent_file_id, 10));
            if (parentFile) {
                rootParentId = parentFile.parent_file_id || parentFile.id;
            }
        }

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

                if (rootParentId) {
                    await files.update(
                        { is_current: false },
                        {
                            where: {
                                [Op.or]: [
                                    { id: rootParentId },
                                    { parent_file_id: rootParentId }
                                ]
                            }
                        }
                    );
                }

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
                    assigned_to: assigned_to ? parseInt(assigned_to, 10) : null,
                    parent_file_id: rootParentId,
                    is_current: true
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

                if (rootParentId) {
                    await files.update(
                        { is_current: false },
                        {
                            where: {
                                [Op.or]: [
                                    { id: rootParentId },
                                    { parent_file_id: rootParentId }
                                ]
                            }
                        }
                    );
                }

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
                    assigned_to: assigned_to ? parseInt(assigned_to, 10) : null,
                    parent_file_id: rootParentId,
                    is_current: true
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

            // Get allowed folders for consultants/vendors in this project
            const allowedMemberFolders = await project_member_folders.findAll({
                where: {
                    folder_id: validFolderId || -1
                }
            });
            const allowedMemberIds = new Set(allowedMemberFolders.map((amf: any) => amf.project_member_id));

            const scanType = (is_doc_mode === 'true' || is_doc_mode === true) ? "documents" : "photos";
            const fileCount = createdFiles.length;
            const notificationTitle = (is_doc_mode === 'true' || is_doc_mode === true) ? "New Documents Uploaded" : "New Photos Uploaded";
            const notificationBody = `${senderName} uploaded ${fileCount} ${scanType}`;

            for (const member of members) {
                if (member.role === 'consultant' || member.role === 'vendor') {
                    if (!allowedMemberIds.has(member.id)) {
                        continue; // Skip notification for restricted folders
                    }
                }
                if (!shouldSkip) {
                    const isAssignee = assigned_to && String(member.user_id) === String(assigned_to);
                    await sendNotification({
                        userId: member.user_id,
                        title: isAssignee ? 'New File Assigned to You' : notificationTitle,
                        body: isAssignee ? `Project Document Assigned: ${senderName} assigned a document to you: ${createdFiles[0].file_name}${fileCount > 1 ? ` (+${fileCount - 1} more)` : ''}` : notificationBody,
                        type: isAssignee ? 'file_assigned' : ((is_doc_mode === 'true' || is_doc_mode === true) ? 'file_upload' : 'photo_upload'),
                        data: { projectId: String(project_id), folderId: String(validFolderId), type: scanType }
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

        // 1. Find or create the "Archive" folder
        const isPhoto = file.file_type?.startsWith('image/');
        let archiveFolder;

        if (isPhoto) {
            // Check if it's in a folder named Confirmations
            let parentId = null;
            if (file.folder_id) {
                const currentFolder = await folders.findByPk(file.folder_id);
                if (currentFolder && (currentFolder.name.toLowerCase() === 'confirmation' || currentFolder.name.toLowerCase() === 'confirmations')) {
                    parentId = currentFolder.id;
                }
            }

            archiveFolder = await folders.findOne({
                where: {
                    project_id: file.project_id,
                    name: { [Op.iLike]: 'Archive' },
                    folder_type: 'photo',
                    parent_id: parentId
                }
            });

            if (!archiveFolder) {
                archiveFolder = await folders.create({
                    project_id: file.project_id,
                    name: "Archive",
                    client_visible: false,
                    parent_id: parentId,
                    created_by: authId,
                    folder_type: 'photo'
                });
            }
        } else {
            archiveFolder = await folders.findOne({
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
                    client_visible: false,
                    parent_id: null,
                    created_by: authId,
                    folder_type: 'document'
                });
            }
        }

        // 2. Update file: move to archive folder and set do_not_follow = true
        const oldFileName = file.file_name;
        file.folder_id = archiveFolder.id;
        file.do_not_follow = true;
        await file.save();

        await logActivity({
            projectId: file.project_id,
            userId: authId,
            type: 'edit',
            description: `Archived ${isPhoto ? 'photo' : 'document'} "${oldFileName}" (Set to Do Not Follow)`,
            metadata: { fileId: file.id, folderId: archiveFolder.id, type: isPhoto ? 'photos' : 'documents' }
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
        const isPhoto = file.file_type?.startsWith('image/');

        // Smart destination: for photos inside a Confirmations/Archive folder,
        // automatically return them to the parent Confirmations folder.
        let resolvedFolderId: number | null = (folder_id === '' || folder_id === 'root' || folder_id === null || folder_id === undefined) ? null : Number(folder_id);

        if (isPhoto && file.folder_id) {
            const currentArchiveFolder = await folders.findByPk(file.folder_id);
            if (
                currentArchiveFolder &&
                currentArchiveFolder.name.toLowerCase() === 'archive' &&
                currentArchiveFolder.parent_id
            ) {
                // The archive folder has a parent — check if that parent is a Confirmations folder
                const parentFolder = await folders.findByPk(currentArchiveFolder.parent_id);
                if (
                    parentFolder &&
                    (parentFolder.name.toLowerCase() === 'confirmation' || parentFolder.name.toLowerCase() === 'confirmations')
                ) {
                    // Return photo to its original Confirmations folder
                    resolvedFolderId = parentFolder.id;
                }
            }
        }

        // 1. Update file: move to resolved folder and reset do_not_follow = false
        file.folder_id = resolvedFolderId;
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
            description: `Unarchived ${isPhoto ? 'photo' : 'document'} "${oldFileName}" to ${targetFolderName}`,
            metadata: { fileId: file.id, folderId: file.folder_id, type: isPhoto ? 'photos' : 'documents' }
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

export const markFileSeen = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { fileId } = req.params;

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Only mark seen if current user is the assignee
        const isAssignee = Array.isArray(file.assigned_to)
            ? file.assigned_to.map(String).includes(String(authUser.user_id))
            : file.assigned_to && String(file.assigned_to) === String(authUser.user_id);

        if (isAssignee) {
            if (!file.seen_at) {
                file.seen_at = new Date();
                await file.save();

                // Broadcast real-time update
                try {
                    const io = getIO();
                    io.to(`project-${file.project_id}`).emit('file-seen', {
                        fileId: file.id,
                        projectId: file.project_id,
                        seen_at: file.seen_at
                    });
                } catch (e) {
                    console.error('Socket emit error:', e);
                }
            }
        }

        res.status(200).json({ success: true, seen_at: file.seen_at });
    } catch (error) {
        console.error("Mark File Seen Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getFileVersions = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { fileId } = req.params;
        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Verify access
        const access = await checkProjectAccess(authUser.user_id, file.project_id, authUser.role, authUser.organization_id);
        if (!access) {
            return res.status(403).json({ error: "Forbidden: No access to this project" });
        }

        const rootId = file.parent_file_id || file.id;

        const versionData = await files.findAll({
            where: {
                [Op.or]: [
                    { id: rootId },
                    { parent_file_id: rootId }
                ]
            },
            include: [
                {
                    model: UsersModel,
                    as: 'creator',
                    attributes: ['id', 'name', 'email']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const versions = await Promise.all(versionData.map(async (v: any) => {
            const fileJson = v.toJSON();
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileJson.file_url
            });
            fileJson.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return fileJson;
        }));

        res.status(200).json({ versions });
    } catch (error) {
        console.error("Get File Versions Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const promoteFile = async (req: Request, res: Response) => {
    const t = await db.sequelize.transaction();
    try {
        const authUser = (req as any).user;
        if (!authUser) {
            await t.rollback();
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { fileId } = req.params;
        const file = await files.findByPk(fileId, { transaction: t });
        if (!file) {
            await t.rollback();
            return res.status(404).json({ error: "File not found" });
        }

        // Only admins, superadmins, contributors or creator can promote
        const authId = authUser.user_id || authUser.id;
        const isCreator = String(file.created_by) === String(authId);
        let isAuthorized = ['admin', 'superadmin'].includes(authUser.role) || isCreator;

        if (!isAuthorized && authUser.role === 'contributor') {
            const membership = await checkProjectAccess(Number(authId), file.project_id, authUser.role, authUser.organization_id);
            if (membership) isAuthorized = true;
        }

        if (!isAuthorized) {
            await t.rollback();
            return res.status(403).json({ error: "Forbidden: You are not authorized to promote this file" });
        }

        const rootId = file.parent_file_id || file.id;

        // Reset is_current on all sibling/root files
        await files.update(
            { is_current: false },
            {
                where: {
                    [Op.or]: [
                        { id: rootId },
                        { parent_file_id: rootId }
                    ]
                },
                transaction: t
            }
        );

        // Set is_current = true for the promoted file
        await file.update({ is_current: true }, { transaction: t });

        await logActivity({
            projectId: file.project_id,
            userId: authId,
            type: 'edit',
            description: `Promoted version "${file.file_name}" to active`,
            metadata: { fileId: file.id, type: file.file_type?.startsWith('image/') ? 'photos' : 'documents' }
        });

        await t.commit();

        res.status(200).json({ message: "Version promoted successfully", file });
    } catch (error) {
        await t.rollback();
        console.error("Promote File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
