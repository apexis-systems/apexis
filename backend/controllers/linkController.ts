import type { Request, Response } from "express";
import { file_links, files, rfis, snags, file_rfi_links, file_snag_links } from "../models/index.ts";

export const linkFiles = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { targetFileId } = req.body;

    try {
        if (!targetFileId) {
            return res.status(400).json({ error: "targetFileId is required" });
        }

        const sourceFile = await files.findByPk(id);
        const targetFile = await files.findByPk(targetFileId);

        if (!sourceFile || !targetFile) {
            return res.status(404).json({ error: "One or both files not found" });
        }

        // Check if link already exists
        const existing = await file_links.findOne({
            where: {
                file_id_1: Math.min(Number(id), Number(targetFileId)),
                file_id_2: Math.max(Number(id), Number(targetFileId)),
            }
        });

        if (existing) {
            return res.status(200).json({ message: "Files are already linked", link: existing });
        }

        const link = await file_links.create({
            file_id_1: Math.min(Number(id), Number(targetFileId)),
            file_id_2: Math.max(Number(id), Number(targetFileId)),
        });

        res.status(201).json({ message: "Files linked successfully", link });
    } catch (error) {
        console.error("linkFiles error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getLinkedItems = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const fileRecord = await files.findByPk(id);
        if (!fileRecord) {
            return res.status(404).json({ error: "File not found" });
        }
        const projectId = fileRecord.project_id;
        const role = (req as any).user?.role || 'admin';

        // Find file links where this file is file_id_1 or file_id_2
        const links1 = await file_links.findAll({
            where: { file_id_1: id },
            include: [{ model: files, as: 'file_2' }]
        });
        
        const links2 = await file_links.findAll({
            where: { file_id_2: id },
            include: [{ model: files, as: 'file_1' }]
        });

        const linkedFiles = [
            ...links1.map((l: any) => l.file_2),
            ...links2.map((l: any) => l.file_1)
        ].filter(f => f != null);

        // Find linked RFIs
        const rfiLinks = await file_rfi_links.findAll({
            where: { file_id: id },
            include: [{ model: rfis }]
        });
        const linkedRfis = rfiLinks.map((l: any) => l.rfi).filter((r: any) => r != null);

        // Find linked Snags
        const snagLinks = await file_snag_links.findAll({
            where: { file_id: id },
            include: [{ model: snags }]
        });
        const linkedSnags = snagLinks.map((l: any) => l.snag).filter((s: any) => s != null);

        const links = [
            ...linkedFiles.map((f: any) => ({
                id: f.id,
                type: 'file',
                title: f.file_name,
                file_type: f.file_type,
                folder_id: f.folder_id,
                url: f.file_url,
                file_url: f.file_url
            })),
            ...linkedRfis.map((r: any) => ({
                id: r.id,
                type: 'rfi',
                title: r.title,
                status: r.status,
                url: `/${role}/project/${projectId}?tab=rfi&rfiId=${r.id}`
            })),
            ...linkedSnags.map((s: any) => ({
                id: s.id,
                type: 'snag',
                title: s.title,
                status: s.status,
                url: `/${role}/project/${projectId}?tab=snags&snagId=${s.id}`
            }))
        ];

        res.status(200).json({
            links,
            files: linkedFiles,
            rfis: linkedRfis,
            snags: linkedSnags
        });
    } catch (error) {
        console.error("getLinkedItems error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteLink = async (req: Request, res: Response) => {
    const { id, targetId, targetType } = req.params;

    try {
        if (targetType === 'file') {
            await file_links.destroy({
                where: {
                    file_id_1: Math.min(Number(id), Number(targetId)),
                    file_id_2: Math.max(Number(id), Number(targetId))
                }
            });
        } else if (targetType === 'rfi') {
            await file_rfi_links.destroy({
                where: { file_id: id, rfi_id: targetId }
            });
        } else if (targetType === 'snag') {
            await file_snag_links.destroy({
                where: { file_id: id, snag_id: targetId }
            });
        } else {
            return res.status(400).json({ error: "Invalid target type" });
        }

        res.status(200).json({ message: "Link deleted successfully" });
    } catch (error) {
        console.error("deleteLink error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
