import type { Request, Response } from "express";
import { getTrashItemsForUser, permanentlyDeleteTrashItem, restoreTrashItem } from "../services/trashService.ts";
import { files, folders, manuals, projects, rfis, snags } from "../models/index.ts";

const findTrashRecord = async (type: string, id: number) => {
    if (type === "project") return projects.findByPk(id, { paranoid: false });
    if (type === "folder") return folders.findByPk(id, { paranoid: false });
    if (type === "file" || type === "document" || type === "photo") return files.findByPk(id, { paranoid: false });
    if (type === "manual") return manuals.findByPk(id, { paranoid: false });
    if (type === "rfi") return rfis.findByPk(id, { paranoid: false });
    if (type === "snag") return snags.findByPk(id, { paranoid: false });
    return null;
};

const canManageTrashItem = (authUser: any, type: string, record: any) => {
    if (!record) return false;
    if (authUser.role === "superadmin" || authUser.role === "admin") return true;
    if (type === "folder") return authUser.role === "contributor";
    if (type === "manual") return Number(record.uploaded_by) === Number(authUser.user_id);
    return Number(record.created_by) === Number(authUser.user_id);
};

export const getTrash = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { organization_id } = req.query;
        const items = await getTrashItemsForUser(authUser, organization_id as string | undefined);
        res.status(200).json({ items });
    } catch (error) {
        console.error("Get Trash Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const restoreTrash = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { type, id } = req.params;
        const record = await findTrashRecord(type, Number(id));

        if (!record) {
            return res.status(404).json({ error: "Trash item not found" });
        }

        if (!canManageTrashItem(authUser, type, record)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        await restoreTrashItem(type, Number(id));
        res.status(200).json({ message: "Item restored successfully" });
    } catch (error: any) {
        console.error("Restore Trash Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

export const deleteTrashPermanently = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { type, id } = req.params;
        const record = await findTrashRecord(type, Number(id));

        if (!record) {
            return res.status(404).json({ error: "Trash item not found" });
        }

        if (!canManageTrashItem(authUser, type, record)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const organizationId =
            type === "project"
                ? Number(record.organization_id || authUser.organization_id)
                : Number(authUser.organization_id || 0);

        await permanentlyDeleteTrashItem(type, Number(id), organizationId);
        res.status(200).json({ message: "Item permanently deleted" });
    } catch (error: any) {
        console.error("Permanent Trash Delete Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};
