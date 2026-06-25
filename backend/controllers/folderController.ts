import type { Request, Response } from "express";
import { folders, files, project_members, activities, users as UsersModel, projects, organizations, project_member_folders, sequelize } from "../models/index.ts";
import { sendNotification } from "../utils/notificationUtils.ts";
import { Op, Transaction } from "sequelize";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { logActivity } from "../utils/activityUtils.ts";

export const createFolder = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

               const { project_id, name, parent_id, folder_type } = req.body;

        // Restriction: Prevent non-admins from creating a folder named "Confidential"
        if (name && name.toLowerCase() === 'confidential') {
            if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                return res.status(403).json({ error: "Forbidden: Only Admins can create a confidential folder" });
            }
        }

        // Restriction: Prevent manual creation of "Archive" folder in documents
        if (folder_type === 'document' && name.toLowerCase() === 'archive') {
            return res.status(400).json({ error: "The name 'Archive' is reserved for system use in documents" });
        }

        // Restriction: Prevent manual creation of "Confirmations" or "Confirmation" folder in photos
        if (folder_type === 'photo' && (name.toLowerCase() === 'confirmation' || name.toLowerCase() === 'confirmations')) {
            return res.status(400).json({ error: "The name 'Confirmations' is reserved for system use in photos" });
        }

        // Restriction: Only "admin" and "contributor" can create folders.
        if (authUser.role !== "admin" && authUser.role !== "contributor") {
            return res.status(403).json({ error: "Forbidden: Only Admins and Contributors can create folders" });
        }

        // If contributor, ensure they belong to the project.
        if (authUser.role === "contributor") {
            const access = await project_members.findOne({
                where: { user_id: authUser.user_id, project_id: project_id }
            });
            if (!access || access.role !== "contributor") {
                return res.status(403).json({ error: "Forbidden: You do not have contributor access to this project" });
            }
        }

        const newFolder = await folders.create({
            project_id,
            name,
            client_visible: true,
            parent_id: parent_id || null,
            created_by: authUser.user_id,
            folder_type: folder_type || null,
        });

        await logActivity({
            projectId: project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Created folder "${name}"`,
            metadata: { folderId: newFolder.id, type: folder_type === 'photo' ? 'photos' : 'documents' }
        });

        res.status(201).json({
            message: "Folder created successfully",
            folder: newFolder
        });
    } catch (error) {
        console.error("Create Folder Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getFolders = async (req: Request, res: Response) => {
    try {
        const { projectId, folder_type } = req.query;

        if (!projectId) {
            return res.status(400).json({ error: "Project ID is required" });
        }

        const authUser = (req as any).user;

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
                    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (t) => {
                        const existsInside = await folders.findOne({
                            where: {
                                project_id,
                                name: { [Op.iLike]: 'Confidential' },
                                folder_type: type
                            },
                            transaction: t
                        });
                        if (!existsInside) {
                            await folders.create({
                                project_id,
                                name: 'Confidential',
                                client_visible: false,
                                created_by: authUser?.user_id,
                                folder_type: type
                            }, { transaction: t });
                        }
                    });
                } catch (err) {
                    console.error(`Error auto-creating Confidential folder:`, err);
                }
            }
        }

        const where: any = { project_id: projectId };
        if (folder_type) {
            where[Op.or] = [
                { folder_type: folder_type },
                { folder_type: null }
            ];
        }

        const projectFolders = await folders.findAll({
            where,
            order: [['createdAt', 'ASC']]
        });

        let result = projectFolders.map((f: any) => f.toJSON());
        if (authUser && authUser.role !== 'admin' && authUser.role !== 'superadmin') {
            result = result.filter((folder: any) => folder.name.toLowerCase() !== 'confidential');
        }

        if (authUser && authUser.role === "client") {
            result = result.filter((folder: any) => folder.client_visible !== false);
        } else if (authUser && (authUser.role === "consultant" || authUser.role === "vendor")) {
            const membership = await project_members.findOne({
                where: { project_id: projectId, user_id: authUser.user_id }
            });
            if (membership) {
                const allowedFolders = await project_member_folders.findAll({
                    where: { project_member_id: membership.id },
                    attributes: ['folder_id']
                });
                const allowedFolderIds = allowedFolders.map((af: any) => af.folder_id);
                result = result.filter((folder: any) => allowedFolderIds.includes(folder.id));
            } else {
                result = [];
            }
        }

        res.status(200).json(result);
    } catch (error) {
        console.error("Get Folders Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const toggleFolderVisibility = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        if (authUser.role !== "admin" && authUser.role !== "superadmin") {
            return res.status(403).json({ error: "Forbidden: Only Admins can toggle visibility" });
        }

        const { folderId } = req.params;
        const { client_visible } = req.body;

        const folder = await folders.findByPk(folderId);
        if (!folder) {
            return res.status(404).json({ error: "Folder not found" });
        }
        const project = await projects.findByPk(folder.project_id);
        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        folder.client_visible = client_visible;
        await folder.save();

        if (client_visible) {
            // Notify clients who actually belong to this project.
            const clients = await project_members.findAll({
                where: { project_id: folder.project_id, role: 'client' },
                attributes: ['user_id']
            });

            for (const client of clients) {
                await sendNotification({
                    userId: Number((client as any).user_id),
                    title: 'New Folder Available',
                    body: `A new folder "${folder.name}" is now visible to you.`,
                    type: 'folder_visibility',
                    data: { folderId: String(folder.id), projectId: String(folder.project_id), type: folder.folder_type || 'documents' }
                });
            }
        }

        res.status(200).json({ message: "Folder visibility updated", folder });
    } catch (error) {
        console.error("Toggle Folder Visibility Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const bulkUpdateFolders = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { ids, parent_id, client_visible } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "No folder IDs provided" });
        }

        // Check if any of the target folders being updated are Confidential
        const targetFoldersList = await folders.findAll({
            where: { id: ids }
        });
        const hasConfidentialTarget = targetFoldersList.some((f: any) => f.name.toLowerCase() === 'confidential');
        if (hasConfidentialTarget) {
            if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                return res.status(403).json({ error: "Forbidden: Only Admins can modify a confidential folder" });
            }
        }

        // If parent_id is provided, check if the target parent folder is Confidential
        if (parent_id !== undefined && parent_id !== null && parent_id !== '' && parent_id !== 'root') {
            const targetParent = await folders.findByPk(parent_id);
            if (targetParent && targetParent.name.toLowerCase() === 'confidential') {
                if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                    return res.status(403).json({ error: "Forbidden: Only Admins can move folders into a confidential folder" });
                }
            }
        }

        // Move action permissions: Admins and Contributors
        if (parent_id !== undefined) {
            if (authUser.role !== "admin" && authUser.role !== "contributor") {
                return res.status(403).json({ error: "Forbidden: Only Admins and Contributors can move folders" });
            }
        }

        // Visibility action permissions: Admins only
        if (client_visible !== undefined) {
            if (authUser.role !== "admin" && authUser.role !== "superadmin") {
                return res.status(403).json({ error: "Forbidden: Only Admins can toggle folder visibility" });
            }
        }

        const updateData: any = {};
        if (parent_id !== undefined) updateData.parent_id = parent_id || null;
        if (client_visible !== undefined) updateData.client_visible = client_visible;

        await folders.update(updateData, {
            where: { id: ids }
        });

        // Activity logging (simplified)
        if (ids.length > 0) {
            const firstFolder = await folders.findByPk(ids[0]);
            if (firstFolder) {
                await logActivity({
                    projectId: firstFolder.project_id,
                    userId: authUser.user_id,
                    type: 'edit',
                    description: `Bulk updated ${ids.length} folders`,
                    metadata: { folderId: firstFolder.id, type: firstFolder.folder_type === 'photo' ? 'photos' : 'documents' }
                });
            }
        }

        res.status(200).json({ message: "Folders updated successfully" });
    } catch (error) {
        console.error("Bulk Update Folders Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateFolder = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { folderId } = req.params;
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: "Folder name is required" });
        }

        const folder = await folders.findByPk(folderId);
        if (!folder) {
            return res.status(404).json({ error: "Folder not found" });
        }

        // Restriction: Prevent non-admins from renaming a folder to "Confidential"
        if (name && name.toLowerCase() === 'confidential') {
            if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                return res.status(403).json({ error: "Forbidden: Only Admins can rename a folder to 'Confidential'" });
            }
        }

        // Restriction: Prevent non-admins from renaming a confidential folder
        if (folder.name && folder.name.toLowerCase() === 'confidential') {
            if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                return res.status(403).json({ error: "Forbidden: Only Admins can rename a confidential folder" });
            }
        }

        // Restriction: Prevent renaming to "Archive" in documents
        if (folder.folder_type === 'document' && name.toLowerCase() === 'archive') {
            return res.status(400).json({ error: "The name 'Archive' is reserved for system use in documents" });
        }

        // Restriction: Prevent renaming to "Confirmations" or "Confirmation" in photos
        if (folder.folder_type === 'photo' && (name.toLowerCase() === 'confirmation' || name.toLowerCase() === 'confirmations')) {
            return res.status(400).json({ error: "The name 'Confirmations' is reserved for system use in photos" });
        }

        // Restriction: Prevent renaming the protected folders themselves
        const folderNameLower = folder.name.toLowerCase();
        if (
            (folder.folder_type === 'photo' && (folderNameLower === 'confirmation' || folderNameLower === 'confirmations' || folderNameLower === 'archive')) ||
            (folder.folder_type === 'document' && folderNameLower === 'archive')
        ) {
            return res.status(400).json({ error: `The folder '${folder.name}' is a system folder and cannot be renamed` });
        }

        // Authorization: Admins or Project Contributors
        if (authUser.role !== "admin" && authUser.role !== "contributor") {
            return res.status(403).json({ error: "Forbidden: Only Admins and Contributors can rename folders" });
        }

        if (authUser.role === "contributor") {
            const access = await project_members.findOne({
                where: { user_id: authUser.user_id, project_id: folder.project_id }
            });
            if (!access || access.role !== "contributor") {
                return res.status(403).json({ error: "Forbidden: You do not have contributor access to this project" });
            }
        }

        const oldName = folder.name;
        folder.name = name;
        await folder.save();

        await logActivity({
            projectId: folder.project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Renamed folder from "${oldName}" to "${name}"`,
            metadata: { folderId: folder.id, type: folder.folder_type === 'photo' ? 'photos' : 'documents' }
        });

        res.status(200).json({
            message: "Folder renamed successfully",
            folder
        });
    } catch (error) {
        console.error("Update Folder Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteFolder = async (req: Request, res: Response) => {
    const t = await sequelize.transaction();
    try {
        const authUser = (req as any).user;
        if (!authUser) {
            await t.rollback();
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { folderId } = req.params;
        const { forceDelete } = req.body;

        const folder = await folders.findByPk(folderId, { transaction: t });
        if (!folder) {
            await t.rollback();
            return res.status(404).json({ error: "Folder not found" });
        }

        // Restriction: Prevent deletion of protected folders
        const folderNameLower = folder.name.toLowerCase();
        if (
            (folderNameLower === 'confirmation' || folderNameLower === 'confirmations' || folderNameLower === 'archive' || folderNameLower === 'confidential')
        ) {
            await t.rollback();
            return res.status(400).json({ error: `The folder '${folder.name}' is a system folder and cannot be deleted` });
        }

        // Authorization: Admins or Project Contributors
        if (authUser.role !== "admin" && authUser.role !== "contributor") {
            await t.rollback();
            return res.status(403).json({ error: "Forbidden: Only Admins and Contributors can delete folders" });
        }

        if (authUser.role === "contributor") {
            const access = await project_members.findOne({
                where: { user_id: authUser.user_id, project_id: folder.project_id },
                transaction: t
            });
            if (!access || access.role !== "contributor") {
                await t.rollback();
                return res.status(403).json({ error: "Forbidden: You do not have contributor access to this project" });
            }
        }

        // Check if folder has content
        const fileCount = await files.count({ where: { folder_id: folderId }, transaction: t });
        const subfolderCount = await folders.count({ where: { parent_id: folderId }, transaction: t });

        if (fileCount > 0 || subfolderCount > 0) {
            if (!forceDelete) {
                await t.rollback();
                return res.status(400).json({ error: "Cannot delete a folder that is not empty", hasContent: true });
            }

            // Soft-delete all descendants so the folder can be restored with its original tree.
            const deleteRecursively = async (fId: any) => {
                const folderFiles = await files.findAll({ where: { folder_id: fId }, transaction: t });
                for (const file of folderFiles) {
                    await file.destroy({ transaction: t });
                }

                const subfoldersList = await folders.findAll({ where: { parent_id: fId }, transaction: t });
                for (const sub of subfoldersList) {
                    await deleteRecursively(sub.id);
                    await sub.destroy({ transaction: t });
                }
            };

            await deleteRecursively(folderId);
        }

        const folderName = folder.name;
        const project_id = folder.project_id;
        await folder.destroy({ transaction: t });

        await logActivity({
            projectId: project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Moved folder "${folderName}" to trash ${forceDelete ? '(with contents)' : ''}`,
            metadata: { folderId: folder.id, type: folder.folder_type === 'photo' ? 'photos' : 'documents' }
        });

        await t.commit();
        res.status(200).json({ message: "Folder moved to trash successfully" });
    } catch (error) {
        await t.rollback();
        console.error("Delete Folder Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
