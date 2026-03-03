import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { reports, files, comments, folders, users, projects } from '../models/index.ts';

// ── Public API ─────────────────────────────────────────────────────────────

export const getReports = async (req: Request, res: Response) => {
    try {
        const { project_id, type } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });

        const where: any = { project_id: Number(project_id) };
        if (type) where.type = type;

        const data = await reports.findAll({
            where,
            order: [['period_start', 'DESC']],
        });

        res.json({ reports: data });
    } catch (error) {
        console.error('getReports error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getReportById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const report = await reports.findByPk(id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        res.json({ report });
    } catch (error) {
        console.error('getReportById error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ── Manual trigger (dev/test) ──────────────────────────────────────────────

export const triggerReport = async (req: Request, res: Response) => {
    try {
        const { project_id, type = 'daily' } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });

        const report = await generateReport(Number(project_id), type as 'daily' | 'weekly');
        res.json({ message: 'Report generated', report });
    } catch (error) {
        console.error('triggerReport error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ── Core generation logic (called by cron + trigger) ───────────────────────

export const generateReport = async (projectId: number, type: 'daily' | 'weekly') => {
    // IST = UTC+5:30. Shift now into IST so calendar day boundaries align with India time.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);

    let periodStartIST: Date;
    let periodEndIST: Date = new Date(nowIST);
    periodEndIST.setHours(23, 59, 59, 999);

    if (type === 'daily') {
        periodStartIST = new Date(nowIST);
        periodStartIST.setHours(0, 0, 0, 0);
    } else {
        // Start from Monday of the current ISO week (in IST)
        periodStartIST = new Date(nowIST);
        const day = periodStartIST.getDay();
        const diff = day === 0 ? 6 : day - 1;
        periodStartIST.setDate(periodStartIST.getDate() - diff);
        periodStartIST.setHours(0, 0, 0, 0);
    }

    // Convert IST boundaries back to UTC for DB queries
    const periodStart = new Date(periodStartIST.getTime() - IST_OFFSET_MS);
    const periodEnd = new Date(periodEndIST.getTime() - IST_OFFSET_MS);

    // Store the IST date string (what the user sees as "the day")
    const startStr = periodStartIST.toISOString().split('T')[0];
    const endStr = periodEndIST.toISOString().split('T')[0];



    // --- Get all folders for this project ---
    const projectFolders = await folders.findAll({ where: { project_id: projectId } });
    const folderIds = projectFolders.map((f: any) => f.id);

    // --- Get all files in those folders uploaded in the period ---
    const uploadedFiles = folderIds.length > 0 ? await files.findAll({
        where: {
            folder_id: { [Op.in]: folderIds },
            createdAt: { [Op.between]: [periodStart, periodEnd] },
        },
        include: [
            { model: users, as: 'creator', attributes: ['id', 'name'] },
            { model: folders, as: 'folder', attributes: ['id', 'name'] },
        ],
    }) : [];

    const photos = uploadedFiles.filter((f: any) => f.file_type?.startsWith('image/'));
    const docs = uploadedFiles.filter((f: any) => !f.file_type?.startsWith('image/'));

    // --- Released files (client_visible = true, updated in period) ---
    const released = folderIds.length > 0 ? await files.findAll({
        where: {
            folder_id: { [Op.in]: folderIds },
            client_visible: true,
            updatedAt: { [Op.between]: [periodStart, periodEnd] },
        },
    }) : [];

    // --- Comments made in the period ---
    const fileIds = uploadedFiles.map((f: any) => f.id);
    const allFileIds = folderIds.length > 0 ? (await files.findAll({
        where: { folder_id: { [Op.in]: folderIds } },
        attributes: ['id'],
    })).map((f: any) => f.id) : [];

    const periodComments = allFileIds.length > 0 ? await comments.findAll({
        where: {
            file_id: { [Op.in]: allFileIds },
            createdAt: { [Op.between]: [periodStart, periodEnd] },
        },
    }) : [];

    // --- Build summary breakdown ---
    const byFolder: Record<string, { name: string; photos: number; docs: number }> = {};
    uploadedFiles.forEach((f: any) => {
        const fid = f.folder_id;
        if (!byFolder[fid]) byFolder[fid] = { name: f.folder?.name || 'Unknown', photos: 0, docs: 0 };
        if (f.file_type?.startsWith('image/')) byFolder[fid].photos++;
        else byFolder[fid].docs++;
    });

    const byUser: Record<string, { name: string; uploads: number }> = {};
    uploadedFiles.forEach((f: any) => {
        const uid = f.created_by;
        if (!byUser[uid]) byUser[uid] = { name: f.creator?.name || 'Unknown', uploads: 0 };
        byUser[uid].uploads++;
    });

    const summary = {
        by_folder: Object.values(byFolder),
        by_user: Object.values(byUser),
        released_files: released.map((f: any) => f.file_name),
    };

    // --- Upsert report ---
    const [report] = await reports.upsert({
        project_id: projectId,
        type,
        period_start: startStr,
        period_end: endStr,
        photos_count: photos.length,
        docs_count: docs.length,
        releases_count: released.length,
        comments_count: periodComments.length,
        summary,
    });

    return report;
};

// ── Generate for ALL active projects (called by cron) ─────────────────────

export const generateAllReports = async (type: 'daily' | 'weekly') => {
    try {
        const allProjects = await projects.findAll({ attributes: ['id'] });
        for (const p of allProjects) {
            await generateReport((p as any).id, type).catch((err) =>
                console.error(`Report generation failed for project ${(p as any).id}:`, err)
            );
        }
        console.log(`[cron] ${type} reports generated for ${allProjects.length} projects`);
    } catch (err) {
        console.error('[cron] generateAllReports error:', err);
    }
};
