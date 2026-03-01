import type { Request, Response } from "express";
import { folders, project_members } from "../models/index.ts";

export const createFolder = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { project_id, name, parent_id } = req.body;

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
            parent_id: parent_id || null,
            created_by: authUser.user_id,
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
        const { projectId } = req.query;

        if (!projectId) {
            return res.status(400).json({ error: "Project ID is required" });
        }

        const projectFolders = await folders.findAll({
            where: { project_id: projectId },
            order: [['createdAt', 'ASC']]
        });

        res.status(200).json(projectFolders);
    } catch (error) {
        console.error("Get Folders Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
