import type { Request, Response } from "express";
import { folders, files, project_members, activities, users as UsersModel } from "../models/index.ts";
import { sendNotification } from "../utils/notificationUtils.ts";
import { Op } from "sequelize";
import { s3Client, BUCKET_NAME } from "./fileController.ts";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export const createFolder = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { project_id, name, parent_id, folder_type } = req.body;

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

        await activities.create({
            project_id,
            user_id: authUser.user_id,
            type: 'edit',
            description: `Created folder "${name}"`
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
        if (authUser && authUser.role === "client") {
            result = result.filter((folder: any) => folder.client_visible !== false);
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

        folder.client_visible = client_visible;
        await folder.save();

        if (client_visible) {
            // Notify clients in the organization
            const clients = await UsersModel.findAll({
                where: { organization_id: authUser.organization_id, role: 'client' }
            });

            for (const client of clients) {
                await sendNotification({
                    userId: (client as any).id,
                    title: 'New Folder Available',
                    body: `A new folder "${folder.name}" is now visible to you.`,
                    type: 'folder_visibility',
                    data: { folderId: String(folder.id), projectId: String(folder.project_id) }
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
                await activities.create({
                    project_id: firstFolder.project_id,
                    user_id: authUser.user_id,
                    type: 'edit',
                    description: `Bulk updated ${ids.length} folders`
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

        await activities.create({
            project_id: folder.project_id,
            user_id: authUser.user_id,
            type: 'edit',
            description: `Renamed folder from "${oldName}" to "${name}"`
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
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { folderId } = req.params;
        const { forceDelete } = req.body;

        const folder = await folders.findByPk(folderId);
        if (!folder) {
            return res.status(404).json({ error: "Folder not found" });
        }

        // Authorization: Admins or Project Contributors
        if (authUser.role !== "admin" && authUser.role !== "contributor") {
            return res.status(403).json({ error: "Forbidden: Only Admins and Contributors can delete folders" });
        }

        if (authUser.role === "contributor") {
            const access = await project_members.findOne({
                where: { user_id: authUser.user_id, project_id: folder.project_id }
            });
            if (!access || access.role !== "contributor") {
                return res.status(403).json({ error: "Forbidden: You do not have contributor access to this project" });
            }
        }

        // Check if folder has content
        const fileCount = await files.count({ where: { folder_id: folderId } });
        const subfolderCount = await folders.count({ where: { parent_id: folderId } });

        if (fileCount > 0 || subfolderCount > 0) {
            if (!forceDelete) {
                return res.status(400).json({ error: "Cannot delete a folder that is not empty", hasContent: true });
            }

            // Recursive deletion logic
            const deleteRecursively = async (fId: any) => {
                // Get all files in this folder
                const folderFiles = await files.findAll({ where: { folder_id: fId } });
                for (const file of folderFiles) {
                    try {
                        // Delete from S3
                        const command = new DeleteObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: file.file_url
                        });
                        await s3Client.send(command);
                    } catch (s3Err) {
                        console.error(`Failed to delete S3 object for file ${file.id}:`, s3Err);
                    }
                    await file.destroy();
                }

                // Get all subfolders
                const subfolders = await folders.findAll({ where: { parent_id: fId } });
                for (const sub of subfolders) {
                    await deleteRecursively(sub.id);
                }
                
                // Finally delete the folder itself (except the root target which is handled at the end)
                if (fId !== folderId) {
                    await folders.destroy({ where: { id: fId } });
                }
            };

            await deleteRecursively(folderId);
        }

        const folderName = folder.name;
        const project_id = folder.project_id;
        await folder.destroy();

        await activities.create({
            project_id,
            user_id: authUser.user_id,
            type: 'edit',
            description: `Deleted folder "${folderName}" ${forceDelete ? '(recursively)' : ''}`
        });

        res.status(200).json({ message: "Folder deleted successfully" });
    } catch (error) {
        console.error("Delete Folder Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

