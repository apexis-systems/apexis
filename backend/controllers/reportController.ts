import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { reports, files, comments, folders, users, projects, rfis, snags, project_members, organizations } from '../models/index.ts';
import { generateSingleReportPDF } from '../services/exportService.ts';

// ── Public API ─────────────────────────────────────────────────────────────

export const shareReport = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Fetch report and project details for naming
        const report = await reports.findByPk(id, {
            include: [{ model: projects, as: 'project', attributes: ['name'] }]
        });

        if (!report) return res.status(404).json({ error: 'Report not found' });
        
        // Parse query options
        const parseBool = (val: any) => val === 'true' || val === true || val === 'ture'; // handle user typo 'ture'
        const options = {
            includeSnags: req.query.snag ? parseBool(req.query.snag) : true,
            includeRFIs: req.query.rfi ? parseBool(req.query.rfi) : true,
            includePhotos: req.query.photos ? parseBool(req.query.photos) : true,
            includeFiles: (req.query.Files || req.query.files) ? parseBool(req.query.Files || req.query.files) : true,
        };

        const pdfBuffer = await generateSingleReportPDF(Number(id), options);

        const projectName = ((report as any).project?.name || 'Project').replace(/\s+/g, '_');
        const type = report.type;
        const start = new Date(report.period_start);
        const end = new Date(report.period_end);

        const fmt = (d: Date) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        };

        let filename = `${projectName}_daily_report_${fmt(start)}.pdf`;
        if (type === 'weekly') {
            filename = `${projectName}_weekly_report_${fmt(start)}_to_${fmt(end)}.pdf`;
        } else if (type === 'monthly') {
            const monthName = start.toLocaleDateString('en-GB', { month: 'long' }).toLowerCase();
            const year = start.getFullYear();
            filename = `${projectName}_monthly_report_${monthName}-${year}.pdf`;
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
    } catch (error: any) {
        console.error('shareReport error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};


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

export const regenerateReport = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const report = await reports.findByPk(id);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        const projectId = report.project_id;
        const type = report.type;

        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const periodStartIST = new Date(report.period_start + 'T00:00:00.000Z');
        const periodEndIST = new Date(report.period_end + 'T23:59:59.999Z');

        // Convert IST boundaries back to UTC for DB queries
        const periodStart = new Date(periodStartIST.getTime() - IST_OFFSET_MS);
        const periodEnd = new Date(periodEndIST.getTime() - IST_OFFSET_MS);

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

        // --- Get Project Members (Clients & Contributors) ---
        const members = await project_members.findAll({
            where: { project_id: projectId },
            include: [{ model: users, attributes: ['name'] }]
        });

        const targetProject = await projects.findByPk(projectId);
        const organization = await organizations.findByPk(targetProject?.organization_id);
        const orgName = organization?.name || 'APEXISpro™ Systems Private Limited';

        const clientList = members.filter((m: any) => m.role === 'client').map((m: any) => m.user?.name).filter(Boolean);
        const contributorList = members.filter((m: any) => m.role === 'contributor').map((m: any) => m.user?.name).filter(Boolean);

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

        const periodRfis = await rfis.findAll({
            where: {
                project_id: projectId,
                [Op.or]: [
                    { createdAt: { [Op.between]: [periodStart, periodEnd] } },
                    { updatedAt: { [Op.between]: [periodStart, periodEnd] } },
                ],
            },
            include: [
                { model: users, as: 'creator', attributes: ['name'] },
                { model: users, as: 'assignee', attributes: ['name'] }
            ]
        });

        // --- Snags in the period ---
        const periodSnags = await snags.findAll({
            where: {
                project_id: projectId,
                [Op.or]: [
                    { createdAt: { [Op.between]: [periodStart, periodEnd] } },
                    { updatedAt: { [Op.between]: [periodStart, periodEnd] } },
                ],
            },
            include: [
                { model: users, as: 'creator', attributes: ['name'] },
                { model: users, as: 'assignee', attributes: ['name'] }
            ]
        });

        // --- Build summary breakdown ---
        const projectName = targetProject?.name || 'Project';
        const folderMap = new Map(projectFolders.map((f: any) => [Number(f.id), f]));
        const folderPathCache = new Map<number, string>();

        const getFullPath = (folderId: number | null): string => {
            if (!folderId) return projectName;
            const id = Number(folderId);
            if (folderPathCache.has(id)) return folderPathCache.get(id)!;

            const f = folderMap.get(id) as any;
            if (!f) return projectName;

            let path = f.name;
            if (f.parent_id) {
                const parentPath = getFullPath(f.parent_id);
                path = `${parentPath}/${f.name}`;
            } else {
                path = `${projectName}/${f.name}`;
            }

            folderPathCache.set(id, path);
            return path;
        };

        const photosByDetails: Record<string, { count: number; user: string; folder: string }> = {};
        photos.forEach((f: any) => {
            const key = `${f.created_by}_${f.folder_id}`;
            if (!photosByDetails[key]) {
                photosByDetails[key] = {
                    count: 0,
                    user: f.creator?.name || 'Unknown',
                    folder: getFullPath(f.folder_id) || 'Unknown',
                };
            }
            photosByDetails[key].count++;
        });

        const summary = {
            client: clientList || ' ',
            consultant: orgName,
            contributors: contributorList || ' ',
            document_titles: docs.map((f: any) => ({
                title: f.file_name,
                user: f.creator?.name || 'Unknown',
                folder: getFullPath(f.folder_id) || 'Unknown',
                date: f.createdAt.toISOString().split('T')[0]
            })),
            photo_summary: Object.values(photosByDetails),
            uploaded_photos: photos.map((f: any) => ({
                key: f.file_url,
                path: getFullPath(f.folder_id) || 'Unknown'
            })),
            rfis: periodRfis.map((r: any) => ({
                title: r.title,
                status: r.status,
                user: r.creator?.name || 'Unknown',
                assigned_to: r.assignee?.name || ' '
            })),
            snags: periodSnags.map((s: any) => ({
                title: s.title,
                status: s.status,
                user: s.creator?.name || 'Unknown',
                assigned_to: s.assignee?.name || ' '
            })),
        };

        const reportData = {
            photos_count: photos.length,
            docs_count: docs.length,
            releases_count: released.length,
            comments_count: periodComments.length,
            summary,
        };

        await report.update(reportData);

        res.json({ message: 'Report regenerated successfully', report });
    } catch (error: any) {
        console.error('regenerateReport error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

// ── Manual trigger (dev/test) ──────────────────────────────────────────────

export const triggerReport = async (req: Request, res: Response) => {
    try {
        const { project_id, type = 'daily' } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });

        const report = await generateReport(Number(project_id), type as 'daily' | 'weekly' | 'monthly');

        res.json({ message: 'Report generated', report });
    } catch (error) {
        console.error('triggerReport error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ── Core generation logic (called by cron + trigger) ───────────────────────

export const generateReport = async (projectId: number, type: 'daily' | 'weekly' | 'monthly', skipIfExists: boolean = false) => {

    // IST = UTC+5:30. Shift now into IST so calendar day boundaries align with India time in UTC methods.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);

    let periodStartIST = new Date(nowIST.getTime());
    let periodEndIST = new Date(nowIST.getTime());

    if (type === 'daily') {
        // Daily: Start of today in IST to end of today in IST
        periodStartIST.setUTCHours(0, 0, 0, 0);
        periodEndIST.setUTCHours(23, 59, 59, 999);
    } else if (type === 'weekly') {
        // ALWAYS Current Week's Monday–Sunday window (7 days) in IST
        const day = periodStartIST.getUTCDay(); // 0 (Sun) to 6 (Sat) in IST
        const diffToMonday = day === 0 ? 6 : day - 1;
        
        periodStartIST.setUTCDate(periodStartIST.getUTCDate() - diffToMonday);
        periodStartIST.setUTCHours(0, 0, 0, 0);

        periodEndIST = new Date(periodStartIST.getTime());
        periodEndIST.setUTCDate(periodEndIST.getUTCDate() + 6);
        periodEndIST.setUTCHours(23, 59, 59, 999);
    } else {
        // Monthly: Start from 1st of the current month in IST to end of today in IST
        periodStartIST.setUTCDate(1);
        periodStartIST.setUTCHours(0, 0, 0, 0);

        periodEndIST.setUTCHours(23, 59, 59, 999);
    }

    // Convert IST boundaries back to UTC for DB queries
    const periodStart = new Date(periodStartIST.getTime() - IST_OFFSET_MS);
    const periodEnd = new Date(periodEndIST.getTime() - IST_OFFSET_MS);

    // Store the IST date string (what the user sees as "the day")
    const startStr = periodStartIST.toISOString().split('T')[0];
    const endStr = periodEndIST.toISOString().split('T')[0];

    if (skipIfExists) {
        const existing = await reports.findOne({
            where: {
                project_id: projectId,
                type,
                period_start: startStr,
            }
        });
        if (existing) {
            console.log(`[report] Skipping ${type} report for project ${projectId} (already exists for ${startStr})`);
            return existing;
        }
    }



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

    // --- Get Project Members (Clients & Contributors) ---
    const members = await project_members.findAll({
        where: { project_id: projectId },
        include: [{ model: users, attributes: ['name'] }]
    });

    const targetProject = await projects.findByPk(projectId);
    const organization = await organizations.findByPk(targetProject?.organization_id);
    const orgName = organization?.name || 'APEXISpro™ Systems Private Limited';

    const clientList = members.filter((m: any) => m.role === 'client').map((m: any) => m.user?.name).filter(Boolean);
    const contributorList = members.filter((m: any) => m.role === 'contributor').map((m: any) => m.user?.name).filter(Boolean);

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

    const periodRfis = await rfis.findAll({
        where: {
            project_id: projectId,
            [Op.or]: [
                { createdAt: { [Op.between]: [periodStart, periodEnd] } },
                { updatedAt: { [Op.between]: [periodStart, periodEnd] } },
            ],
        },
        include: [
            { model: users, as: 'creator', attributes: ['name'] },
            { model: users, as: 'assignee', attributes: ['name'] }
        ]
    });

    // --- Snags in the period ---
    const periodSnags = await snags.findAll({
        where: {
            project_id: projectId,
            [Op.or]: [
                { createdAt: { [Op.between]: [periodStart, periodEnd] } },
                { updatedAt: { [Op.between]: [periodStart, periodEnd] } },
            ],
        },
        include: [
            { model: users, as: 'creator', attributes: ['name'] },
            { model: users, as: 'assignee', attributes: ['name'] }
        ]
    });

    // --- Build summary breakdown ---
    const projectName = targetProject?.name || 'Project';
    const folderMap = new Map(projectFolders.map((f: any) => [Number(f.id), f]));
    const folderPathCache = new Map<number, string>();

    const getFullPath = (folderId: number | null): string => {
        if (!folderId) return projectName;
        const id = Number(folderId);
        if (folderPathCache.has(id)) return folderPathCache.get(id)!;

        const f = folderMap.get(id) as any;
        if (!f) return projectName;

        let path = f.name;
        if (f.parent_id) {
            const parentPath = getFullPath(f.parent_id);
            path = `${parentPath}/${f.name}`;
        } else {
            path = `${projectName}/${f.name}`;
        }

        folderPathCache.set(id, path);
        return path;
    };

    const photosByDetails: Record<string, { count: number; user: string; folder: string }> = {};
    photos.forEach((f: any) => {
        const key = `${f.created_by}_${f.folder_id}`;
        if (!photosByDetails[key]) {
            photosByDetails[key] = {
                count: 0,
                user: f.creator?.name || 'Unknown',
                folder: getFullPath(f.folder_id) || 'Unknown',
            };
        }
        photosByDetails[key].count++;
    });

    const summary = {
        client: clientList || ' ',
        consultant: orgName,
        contributors: contributorList || ' ',
        document_titles: docs.map((f: any) => ({
            title: f.file_name,
            user: f.creator?.name || 'Unknown',
            folder: getFullPath(f.folder_id) || 'Unknown',
            date: f.createdAt.toISOString().split('T')[0]
        })),
        photo_summary: Object.values(photosByDetails),
        uploaded_photos: photos.map((f: any) => ({
            key: f.file_url,
            path: getFullPath(f.folder_id) || 'Unknown'
        })),
        rfis: periodRfis.map((r: any) => ({
            title: r.title,
            status: r.status,
            user: r.creator?.name || 'Unknown',
            assigned_to: r.assignee?.name || ' '
        })),
        snags: periodSnags.map((s: any) => ({
            title: s.title,
            status: s.status,
            user: s.creator?.name || 'Unknown',
            assigned_to: s.assignee?.name || ' '
        })),
    };

    // --- Update OR Create report ---
    let report = await reports.findOne({
        where: {
            project_id: projectId,
            type,
            period_start: startStr,
        }
    });

    const reportData = {
        period_end: endStr,
        photos_count: photos.length,
        docs_count: docs.length,
        releases_count: released.length,
        comments_count: periodComments.length,
        summary,
    };

    if (report) {
        await report.update(reportData);
    } else {
        report = await reports.create({
            project_id: projectId,
            type,
            period_start: startStr,
            ...reportData,
        });
    }

    return report;
};

// ── Generate for ALL active projects (called by cron) ─────────────────────

export const generateAllReports = async (type: 'daily' | 'weekly' | 'monthly') => {

    try {
        const allProjects = await projects.findAll({ attributes: ['id'] });
        for (const p of allProjects) {
            await generateReport((p as any).id, type, true).catch((err) =>
                console.error(`Report generation failed for project ${(p as any).id}:`, err)
            );
        }
        console.log(`[cron] ${type} reports generated for ${allProjects.length} projects`);
    } catch (err) {
        console.error('[cron] generateAllReports error:', err);
    }
};
