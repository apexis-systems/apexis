import type { Request, Response } from "express";
import {
    archiveProject,
    restoreProjectArchive,
    getArchivedProjects,
    getArchiveDownloadUrl,
    deleteArchivedProjectPermanently,
} from "../services/archiveService.ts";

export const archiveProjectHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can archive projects" });
        }

        const projectId = Number(id);
        const organizationId = Number(authUser.organization_id);
        const userId = Number(authUser.user_id);

        if (!projectId) {
            return res.status(400).json({ error: "Invalid project ID" });
        }

        // Trigger archival process (runs synchronously with socket updates or completes)
        const archiveResult = await archiveProject(projectId, organizationId, userId);

        return res.status(200).json({
            message: "Project zipped and archived successfully",
            archive: archiveResult,
        });
    } catch (error: any) {
        console.error("Archive Project Handler Error:", error);
        return res.status(500).json({
            error: error?.message || "Internal server error during project archival",
        });
    }
};

export const getArchivedProjectsHandler = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can view archived projects" });
        }

        const organizationId = Number(authUser.organization_id);
        const archives = await getArchivedProjects(organizationId);

        return res.status(200).json({
            archives,
            total: archives.length,
        });
    } catch (error: any) {
        console.error("Get Archived Projects Error:", error);
        return res.status(500).json({
            error: error?.message || "Internal server error fetching archived projects",
        });
    }
};

export const getArchiveDownloadUrlHandler = async (req: Request, res: Response) => {
    try {
        const { archiveId } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can download archived projects" });
        }

        const organizationId = Number(authUser.organization_id);
        const downloadUrl = await getArchiveDownloadUrl(Number(archiveId), organizationId);

        return res.status(200).json({ downloadUrl });
    } catch (error: any) {
        console.error("Get Archive Download URL Error:", error);
        return res.status(500).json({
            error: error?.message || "Internal server error generating download URL",
        });
    }
};

export const restoreProjectArchiveHandler = async (req: Request, res: Response) => {
    try {
        const { archiveId } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can restore archived projects" });
        }

        const organizationId = Number(authUser.organization_id);
        const userId = Number(authUser.user_id);

        const restoredProject = await restoreProjectArchive(Number(archiveId), organizationId, userId);

        return res.status(200).json({
            message: "Project successfully unzipped and restored",
            project: restoredProject,
        });
    } catch (error: any) {
        console.error("Restore Project Archive Handler Error:", error);
        return res.status(500).json({
            error: error?.message || "Internal server error during project restoration",
        });
    }
};

export const deleteArchivedProjectHandler = async (req: Request, res: Response) => {
    try {
        const { archiveId } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can permanently delete archives" });
        }

        const organizationId = Number(authUser.organization_id);
        await deleteArchivedProjectPermanently(Number(archiveId), organizationId);

        return res.status(200).json({
            message: "Archived project permanently deleted",
        });
    } catch (error: any) {
        console.error("Delete Archived Project Handler Error:", error);
        return res.status(500).json({
            error: error?.message || "Internal server error deleting archive",
        });
    }
};
