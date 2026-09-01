import { getIO } from "../socket.ts";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import db, {
    projects,
    folders,
    files,
    project_members,
    project_member_folders,
    rfis,
    snags,
    comments,
    manuals,
    reports,
    activities,
    rooms,
    room_members,
    chat_messages,
    conversation_messages,
    notifications,
    file_links,
    file_rfi_links,
    file_snag_links,
    file_flag_history,
    blocked_users,
    organizations,
    archived_projects,
    users,
    sequelize,
} from "../models/index.ts";
import { SimpleZip } from "../utils/zipBuilder.ts";
import { checkProjectLimit } from "../utils/subscriptionAccess.ts";
import { Op } from "sequelize";

export const activeArchivals = new Map<number, { startTime: number; statusText: string }>();

const fetchS3Buffer = async (fileKey: string): Promise<Buffer | null> => {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
        });
        const s3Item = await s3Client.send(command);
        if (!s3Item.Body) return null;

        if (typeof (s3Item.Body as any).transformToByteArray === "function") {
            const u8Arr = await (s3Item.Body as any).transformToByteArray();
            return Buffer.from(u8Arr);
        } else if (typeof (s3Item.Body as any).transformToWebStream === "function") {
            const webStream = (s3Item.Body as any).transformToWebStream();
            const reader = webStream.getReader();
            const chunks: any[] = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            return Buffer.concat(chunks);
        }

        return new Promise((resolve, reject) => {
            const chunks: any[] = [];
            (s3Item.Body as any).on("data", (chunk: any) => chunks.push(chunk));
            (s3Item.Body as any).on("error", reject);
            (s3Item.Body as any).on("end", () => resolve(Buffer.concat(chunks)));
        });
    } catch (err) {
        console.error(`fetchS3Buffer failed for ${fileKey}:`, err);
        return null;
    }
};

/**
 * Archive & Zip a complete project:
 * 1. Collects all database entities and relationships.
 * 2. Compiles a standalone .zip package containing all files and manifest.
 * 3. Uploads the .zip to S3 archive storage.
 * 4. Saves full snapshot to archived_projects table.
 * 5. Purges active operational entities from DB and updates organization counts.
 */
export const archiveProject = async (projectId: number, organizationId: number, userId: number) => {
    const io = getIO();
    const userRoom = `user-${userId}`;
    const startTime = Date.now();

    const emitStatus = (status: string, statusType: "progress" | "success" | "failed" = "progress", extra: any = {}) => {
        const payload = { projectId, status, statusType, ...extra };
        if (statusType === "progress") {
            activeArchivals.set(projectId, { startTime, statusText: status });
        } else {
            activeArchivals.delete(projectId);
        }
        io.to(userRoom).emit("archive-status", payload);
    };

    let archiveRecord: any = null;

    try {
        emitStatus("Preparing project archival...", "progress");

        const targetProject = await projects.findOne({
            where: { id: projectId, organization_id: organizationId },
            paranoid: false,
        });

        if (!targetProject) {
            throw new Error("Project not found or unauthorized");
        }

        // Create initial pending archive entry
        archiveRecord = await archived_projects.create({
            organization_id: organizationId,
            original_project_id: projectId,
            name: targetProject.name,
            description: targetProject.description,
            contributor_code: targetProject.contributor_code,
            client_code: targetProject.client_code,
            start_date: targetProject.start_date,
            end_date: targetProject.end_date,
            created_by: targetProject.created_by,
            archived_by: userId,
            archived_at: new Date(),
            status: "archiving",
            stats_summary: {},
            snapshot_data: {},
        });

        emitStatus("Extracting relational project data...", "progress");

        // 1. Fetch all project relational data
        const [
            projectMembersList,
            foldersList,
            filesList,
            rfisList,
            snagsList,
            commentsList,
            manualsList,
            reportsList,
            activitiesList,
        ] = await Promise.all([
            project_members.findAll({
                where: { project_id: projectId },
                include: [{ model: project_member_folders }],
            }),
            folders.findAll({ where: { project_id: projectId }, paranoid: false }),
            files.findAll({ where: { project_id: projectId }, paranoid: false }),
            rfis.findAll({ where: { project_id: projectId }, paranoid: false }),
            snags.findAll({ where: { project_id: projectId }, paranoid: false }),
            comments.findAll({
                include: [{
                    model: files,
                    where: { project_id: projectId },
                    attributes: ["id"],
                    required: true,
                }],
            }),
            manuals.findAll({ where: { project_id: projectId }, paranoid: false }),
            reports.findAll({ where: { project_id: projectId } }),
            activities.findAll({ where: { project_id: projectId } }),
        ]);

        const fileIds = filesList.map((f: any) => f.id);
        const rfiIds = rfisList.map((r: any) => r.id);
        const snagIds = snagsList.map((s: any) => s.id);

        const [
            fileLinksList,
            fileRfiLinksList,
            fileSnagLinksList,
            fileFlagHistoryList,
        ] = await Promise.all([
            fileIds.length > 0
                ? file_links.findAll({
                    where: {
                        [Op.or]: [
                            { file_id_1: { [Op.in]: fileIds } },
                            { file_id_2: { [Op.in]: fileIds } },
                        ],
                    },
                })
                : [],
            fileIds.length > 0 || rfiIds.length > 0
                ? file_rfi_links.findAll({
                    where: {
                        [Op.or]: [
                            ...(fileIds.length ? [{ file_id: { [Op.in]: fileIds } }] : []),
                            ...(rfiIds.length ? [{ rfi_id: { [Op.in]: rfiIds } }] : []),
                        ],
                    },
                })
                : [],
            fileIds.length > 0 || snagIds.length > 0
                ? file_snag_links.findAll({
                    where: {
                        [Op.or]: [
                            ...(fileIds.length ? [{ file_id: { [Op.in]: fileIds } }] : []),
                            ...(snagIds.length ? [{ snag_id: { [Op.in]: snagIds } }] : []),
                        ],
                    },
                })
                : [],
            fileIds.length > 0
                ? file_flag_history.findAll({
                    where: { file_id: { [Op.in]: fileIds } },
                })
                : [],
        ]);

        // Compute summary statistics
        let photosCount = 0;
        let docsCount = 0;
        let totalSizeMb = 0;

        filesList.forEach((f: any) => {
            if (f.file_type && f.file_type.startsWith("image/")) {
                photosCount++;
            } else {
                docsCount++;
            }
            totalSizeMb += Number(f.file_size_mb || 0);
        });

        manualsList.forEach((m: any) => {
            totalSizeMb += Number(m.file_size_mb || 0);
        });

        const statsSummary = {
            total_files: filesList.length,
            total_photos: photosCount,
            total_docs: docsCount,
            total_snags: snagsList.length,
            total_rfis: rfisList.length,
            total_comments: commentsList.length,
            total_members: projectMembersList.length,
            storage_mb: Math.round(totalSizeMb * 100) / 100,
        };

        // Complete snapshot data structure
        const snapshotData = {
            project: targetProject.toJSON ? targetProject.toJSON() : targetProject,
            members: projectMembersList.map((m: any) => m.toJSON ? m.toJSON() : m),
            folders: foldersList.map((f: any) => f.toJSON ? f.toJSON() : f),
            files: filesList.map((f: any) => f.toJSON ? f.toJSON() : f),
            rfis: rfisList.map((r: any) => r.toJSON ? r.toJSON() : r),
            snags: snagsList.map((s: any) => s.toJSON ? s.toJSON() : s),
            comments: commentsList.map((c: any) => c.toJSON ? c.toJSON() : c),
            manuals: manualsList.map((m: any) => m.toJSON ? m.toJSON() : m),
            reports: reportsList.map((r: any) => r.toJSON ? r.toJSON() : r),
            activities: activitiesList.map((a: any) => a.toJSON ? a.toJSON() : a),
            file_links: fileLinksList.map((fl: any) => fl.toJSON ? fl.toJSON() : fl),
            file_rfi_links: fileRfiLinksList.map((fr: any) => fr.toJSON ? fr.toJSON() : fr),
            file_snag_links: fileSnagLinksList.map((fs: any) => fs.toJSON ? fs.toJSON() : fs),
            file_flag_history: fileFlagHistoryList.map((fh: any) => fh.toJSON ? fh.toJSON() : fh),
        };

        // 2. Build ZIP Package
        emitStatus("Packaging assets into ZIP archive...", "progress");
        const zip = new SimpleZip();

        // Add human-readable manifest & full relational data
        zip.addFile(
            "project-manifest.json",
            JSON.stringify(
                {
                    archived_at: new Date().toISOString(),
                    project_name: targetProject.name,
                    description: targetProject.description,
                    stats: statsSummary,
                    data_schema_version: "2.0",
                },
                null,
                2
            )
        );

        zip.addFile(
            "database-snapshot.json",
            JSON.stringify(snapshotData, null, 2)
        );

        // Build folder path map
        const folderMap = new Map<number, any>();
        foldersList.forEach((f: any) => folderMap.set(f.id, f));

        const getFolderPath = (folderId: number | null): string => {
            if (!folderId) return "root";
            const f = folderMap.get(folderId);
            if (!f) return "root";
            const parent = f.parent_id ? getFolderPath(f.parent_id) + "/" : "";
            return `${parent}${f.name}`.replace(/[\\/:*?"<>|]/g, "_");
        };

        // Download S3 files in batches of 8
        const downloadTasks: { relativeZipPath: string; s3Key: string }[] = [];

        filesList.forEach((f: any, idx: number) => {
            if (!f.file_url) return;
            const folderSubPath = getFolderPath(f.folder_id);
            const sanitizedName = (f.file_name || `file-${idx}`).replace(/[\\/:*?"<>|]/g, "_");
            const category = f.file_type?.startsWith("image/") ? "photos" : "documents";
            downloadTasks.push({
                relativeZipPath: `${category}/${folderSubPath}/${sanitizedName}`,
                s3Key: f.file_url,
            });
        });

        manualsList.forEach((m: any, idx: number) => {
            if (!m.file_url) return;
            const sanitizedName = (m.title || `manual-${idx}`).replace(/[\\/:*?"<>|]/g, "_");
            downloadTasks.push({
                relativeZipPath: `manuals/${sanitizedName}.pdf`,
                s3Key: m.file_url,
            });
        });

        reportsList.forEach((r: any, idx: number) => {
            if (!r.file_url) return;
            const sanitizedName = (r.name || `report-${idx}`).replace(/[\\/:*?"<>|]/g, "_");
            downloadTasks.push({
                relativeZipPath: `reports/${sanitizedName}.pdf`,
                s3Key: r.file_url,
            });
        });

        snagsList.forEach((s: any) => {
            if (s.photo_url) {
                downloadTasks.push({
                    relativeZipPath: `snags/snag-${s.id}/photo.jpg`,
                    s3Key: s.photo_url,
                });
            }
            if (Array.isArray(s.response_photos)) {
                s.response_photos.forEach((photo: string, pIdx: number) => {
                    downloadTasks.push({
                        relativeZipPath: `snags/snag-${s.id}/response-${pIdx + 1}.jpg`,
                        s3Key: photo,
                    });
                });
            }
        });

        rfisList.forEach((r: any) => {
            if (Array.isArray(r.photos)) {
                r.photos.forEach((photo: string, pIdx: number) => {
                    downloadTasks.push({
                        relativeZipPath: `rfis/rfi-${r.id}/photo-${pIdx + 1}.jpg`,
                        s3Key: photo,
                    });
                });
            }
            if (Array.isArray(r.response_photos)) {
                r.response_photos.forEach((photo: string, pIdx: number) => {
                    downloadTasks.push({
                        relativeZipPath: `rfis/rfi-${r.id}/response-${pIdx + 1}.jpg`,
                        s3Key: photo,
                    });
                });
            }
        });

        const batchSize = 8;
        let downloadedCount = 0;
        const totalToDownload = downloadTasks.length;

        for (let i = 0; i < downloadTasks.length; i += batchSize) {
            const batch = downloadTasks.slice(i, i + batchSize);
            await Promise.all(
                batch.map(async (task) => {
                    const buf = await fetchS3Buffer(task.s3Key);
                    if (buf) {
                        zip.addFile(task.relativeZipPath, buf);
                    }
                    downloadedCount++;
                })
            );
            emitStatus(
                `Downloading & bundling files (${downloadedCount}/${totalToDownload})...`,
                "progress"
            );
        }

        emitStatus("Compressing and uploading ZIP archive...", "progress");
        const zipBuffer = zip.build();
        const zipKey = `archives/org-${organizationId}/project-${projectId}-${Date.now()}.zip`;

        await s3Client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: zipKey,
                ContentType: "application/zip",
                Body: zipBuffer,
            })
        );

        // 3. Update archived_projects record with completed status
        await archiveRecord.update({
            zip_file_url: zipKey,
            zip_file_size_bytes: zipBuffer.length,
            stats_summary: statsSummary,
            snapshot_data: snapshotData,
            status: "archived",
        });

        // 4. Safely clean up active operational entities from DB
        emitStatus("Offloading project from active workspace...", "progress");
        const t = await sequelize.transaction();
        try {
            if (fileIds.length > 0) {
                await comments.destroy({ where: { file_id: { [Op.in]: fileIds } }, transaction: t });
                await file_flag_history.destroy({ where: { file_id: { [Op.in]: fileIds } }, transaction: t });
                await file_links.destroy({
                    where: {
                        [Op.or]: [
                            { file_id_1: { [Op.in]: fileIds } },
                            { file_id_2: { [Op.in]: fileIds } },
                        ],
                    },
                    transaction: t,
                });
                await file_rfi_links.destroy({ where: { file_id: { [Op.in]: fileIds } }, transaction: t });
                await file_snag_links.destroy({ where: { file_id: { [Op.in]: fileIds } }, transaction: t });
            }

            await files.destroy({ where: { project_id: projectId }, force: true, transaction: t });
            await manuals.destroy({ where: { project_id: projectId }, force: true, transaction: t });
            await snags.destroy({ where: { project_id: projectId }, force: true, transaction: t });
            await rfis.destroy({ where: { project_id: projectId }, force: true, transaction: t });
            await activities.destroy({ where: { project_id: projectId }, transaction: t });
            await notifications.destroy({ where: { project_id: projectId }, transaction: t });
            await reports.destroy({ where: { project_id: projectId }, transaction: t });
            await folders.destroy({ where: { project_id: projectId }, force: true, transaction: t });

            const projectRooms = await rooms.findAll({ where: { project_id: projectId }, transaction: t });
            const roomIds = projectRooms.map((r: any) => r.id);
            if (roomIds.length > 0) {
                await chat_messages.destroy({ where: { room_id: { [Op.in]: roomIds } }, transaction: t });
                await room_members.destroy({ where: { room_id: { [Op.in]: roomIds } }, transaction: t });
                await rooms.destroy({ where: { project_id: projectId }, transaction: t });
            }

            await conversation_messages.destroy({ where: { project_id: projectId }, transaction: t });
            await blocked_users.destroy({ where: { project_id: projectId }, transaction: t });
            await project_members.destroy({ where: { project_id: projectId }, transaction: t });

            // Permanently remove project row from active projects table to free organization project seat
            await targetProject.destroy({ force: true, transaction: t });

            await t.commit();
        } catch (dbPurgeErr) {
            await t.rollback();
            console.error("DB cleanup during project archive failed:", dbPurgeErr);
        }

        emitStatus("Project successfully zipped and archived!", "success", {
            archiveId: archiveRecord.id,
            stats: statsSummary,
        });

        return archiveRecord;
    } catch (err: any) {
        console.error("archiveProject error:", err);
        if (archiveRecord) {
            await archiveRecord.update({
                status: "failed",
                error_message: err?.message || "Unknown error during archival",
            });
        }
        emitStatus(err?.message || "Archival failed", "failed", { error: err?.message });
        throw err;
    }
};

/**
 * Unzip & Restore an archived project back into the active organization:
 * 1. Checks organization active project quota.
 * 2. Re-inserts project with all nested folders, files, versions, RFIs, snags, pin links, comments, and member permissions.
 * 3. Removes archive record once restored.
 */
export const restoreProjectArchive = async (archiveId: number, organizationId: number, userId: number) => {
    const io = getIO();
    const userRoom = `user-${userId}`;

    const emitStatus = (status: string, statusType: "progress" | "success" | "failed" = "progress", extra: any = {}) => {
        io.to(userRoom).emit("restore-status", { archiveId, status, statusType, ...extra });
    };

    try {
        emitStatus("Validating organization project quota...", "progress");

        // 1. Check Project Quota Limit
        const limitCheck = await checkProjectLimit(organizationId);
        if (!limitCheck.allowed) {
            throw new Error(limitCheck.message || "Project limit reached. Upgrade plan to restore project.");
        }

        const archive = await archived_projects.findOne({
            where: { id: archiveId, organization_id: organizationId },
        });

        if (!archive) {
            throw new Error("Archived project not found");
        }

        if (archive.status !== "archived" && archive.status !== "restoring") {
            throw new Error(`Cannot restore project with status: ${archive.status}`);
        }

        await archive.update({ status: "restoring" });

        emitStatus("Restoring project relational data...", "progress");
        const snapshot = archive.snapshot_data;
        if (!snapshot || !snapshot.project) {
            throw new Error("Corrupted archive snapshot data");
        }

        const t = await sequelize.transaction();

        try {
            // 1. Restore Project Record
            const projData = snapshot.project;
            const restoredProject = await projects.create(
                {
                    organization_id: organizationId,
                    name: projData.name,
                    description: projData.description || null,
                    contributor_code: projData.contributor_code,
                    client_code: projData.client_code,
                    start_date: projData.start_date,
                    end_date: projData.end_date,
                    created_by: projData.created_by || userId,
                    restrict_onboarding: projData.restrict_onboarding !== undefined ? projData.restrict_onboarding : false,
                    last_export_url: projData.last_export_url || null,
                    last_export_date: projData.last_export_date || null,
                },
                { transaction: t }
            );

            const newProjectId = restoredProject.id;

            // 2. Restore Folders (Topological parent-child restoration)
            const oldToNewFolderMap = new Map<number, number>();
            const foldersList = snapshot.folders || [];

            // Sort folders so root folders (parent_id == null) come first
            const sortedFolders = [...foldersList].sort((a: any, b: any) => {
                if (!a.parent_id && b.parent_id) return -1;
                if (a.parent_id && !b.parent_id) return 1;
                return 0;
            });

            for (const folder of sortedFolders) {
                const newParentId = folder.parent_id ? oldToNewFolderMap.get(folder.parent_id) || null : null;
                const newFolder = await folders.create(
                    {
                        project_id: newProjectId,
                        name: folder.name,
                        parent_id: newParentId,
                        folder_type: folder.folder_type || "document",
                        client_visible: folder.client_visible !== undefined ? folder.client_visible : false,
                        created_by: folder.created_by || userId,
                        password: folder.password || null,
                        is_locked: folder.is_locked !== undefined ? folder.is_locked : false,
                    },
                    { transaction: t }
                );
                oldToNewFolderMap.set(folder.id, newFolder.id);
            }

            // 3. Restore Files & Versions
            const oldToNewFileMap = new Map<number, number>();
            const filesList = snapshot.files || [];

            for (const file of filesList) {
                const newFolderId = file.folder_id ? oldToNewFolderMap.get(file.folder_id) || null : null;
                
                // Format tags safely as string or null
                let formattedTags: string | null = null;
                if (typeof file.tags === "string") {
                    formattedTags = file.tags;
                } else if (Array.isArray(file.tags) && file.tags.length > 0) {
                    formattedTags = file.tags.join(",");
                }

                const newFile = await files.create(
                    {
                        project_id: newProjectId,
                        folder_id: newFolderId,
                        file_name: file.file_name,
                        file_url: file.file_url,
                        file_type: file.file_type,
                        file_size_mb: typeof file.file_size_mb === 'number' ? file.file_size_mb : parseInt(file.file_size_mb || '0', 10) || 0,
                        created_by: file.created_by || userId,
                        client_visible: file.client_visible !== undefined ? file.client_visible : false,
                        do_not_follow: file.do_not_follow !== undefined ? file.do_not_follow : false,
                        only_for_reference: file.only_for_reference !== undefined ? file.only_for_reference : false,
                        location: file.location || null,
                        tags: formattedTags,
                        assigned_to: Array.isArray(file.assigned_to) ? file.assigned_to : null,
                        seen_at: file.seen_at || null,
                        seen_by: Array.isArray(file.seen_by) ? file.seen_by : [],
                        is_current: file.is_current !== undefined ? file.is_current : true,
                    },
                    { transaction: t }
                );
                oldToNewFileMap.set(file.id, newFile.id);
            }

            // Re-link parent_file_id for versions if applicable
            for (const file of filesList) {
                if (file.parent_file_id) {
                    const newFileId = oldToNewFileMap.get(file.id);
                    const newParentFileId = oldToNewFileMap.get(file.parent_file_id);
                    if (newFileId && newParentFileId) {
                        await files.update(
                            { parent_file_id: newParentFileId },
                            { where: { id: newFileId }, transaction: t }
                        );
                    }
                }
            }

            // 4. Restore File Flag History
            const flagHistList = snapshot.file_flag_history || [];
            for (const fh of flagHistList) {
                const newFileId = oldToNewFileMap.get(fh.file_id);
                if (newFileId) {
                    await file_flag_history.create(
                        {
                            file_id: newFileId,
                            flag: fh.flag,
                            flag_color: fh.flag_color || null,
                            changed_by: fh.changed_by || userId,
                        },
                        { transaction: t }
                    );
                }
            }

            // 5. Restore RFIs
            const oldToNewRfiMap = new Map<number, number>();
            const rfisList = snapshot.rfis || [];
            for (const rfi of rfisList) {
                const newRfi = await rfis.create(
                    {
                        project_id: newProjectId,
                        title: rfi.title,
                        description: rfi.description || rfi.question || null,
                        status: rfi.status || "open",
                        assigned_to: rfi.assigned_to || null,
                        created_by: rfi.created_by || userId,
                        is_client_visible: rfi.is_client_visible !== undefined ? rfi.is_client_visible : false,
                        photos: rfi.photos || null,
                        expiry_date: rfi.expiry_date || rfi.due_date || null,
                        response: rfi.response || rfi.answer || null,
                        response_photos: rfi.response_photos || null,
                        folder_ids: Array.isArray(rfi.folder_ids) ? rfi.folder_ids.map((fid: number) => oldToNewFolderMap.get(fid) || fid) : [],
                        seen_at: rfi.seen_at || null,
                    },
                    { transaction: t }
                );
                oldToNewRfiMap.set(rfi.id, newRfi.id);
            }

            // 6. Restore Snags
            const oldToNewSnagMap = new Map<number, number>();
            const snagsList = snapshot.snags || [];
            for (const snag of snagsList) {
                const newSnag = await snags.create(
                    {
                        project_id: newProjectId,
                        title: snag.title || "Snag",
                        description: snag.description || null,
                        photo_url: snag.photo_url || null,
                        audio_url: snag.audio_url || null,
                        assigned_to: snag.assigned_to || null,
                        status: snag.status || "amber",
                        response: snag.response || null,
                        response_photos: snag.response_photos || null,
                        created_by: snag.created_by || userId,
                        seen_at: snag.seen_at || null,
                        folder_ids: Array.isArray(snag.folder_ids) ? snag.folder_ids.map((fid: number) => oldToNewFolderMap.get(fid) || fid) : [],
                    },
                    { transaction: t }
                );
                oldToNewSnagMap.set(snag.id, newSnag.id);
            }

            // 7. Restore Links (Drawings Pins / RFIs / Snags)
            const fileLinksList = snapshot.file_links || [];
            for (const fl of fileLinksList) {
                const f1 = oldToNewFileMap.get(fl.file_id_1);
                const f2 = oldToNewFileMap.get(fl.file_id_2);
                if (f1 && f2) {
                    await file_links.create({ file_id_1: f1, file_id_2: f2 }, { transaction: t });
                }
            }

            const fileRfiLinksList = snapshot.file_rfi_links || [];
            for (const fr of fileRfiLinksList) {
                const fid = oldToNewFileMap.get(fr.file_id);
                const rid = oldToNewRfiMap.get(fr.rfi_id);
                if (fid && rid) {
                    await file_rfi_links.create(
                        {
                            file_id: fid,
                            rfi_id: rid,
                        },
                        { transaction: t }
                    );
                }
            }

            const fileSnagLinksList = snapshot.file_snag_links || [];
            for (const fs of fileSnagLinksList) {
                const fid = oldToNewFileMap.get(fs.file_id);
                const sid = oldToNewSnagMap.get(fs.snag_id);
                if (fid && sid) {
                    await file_snag_links.create(
                        {
                            file_id: fid,
                            snag_id: sid,
                        },
                        { transaction: t }
                    );
                }
            }

            // 8. Restore Comments
            const commentsList = snapshot.comments || [];
            const oldToNewCommentMap = new Map<number, number>();
            for (const c of commentsList) {
                const newFileId = oldToNewFileMap.get(c.file_id);
                if (newFileId) {
                    const newParentId = c.parent_id ? oldToNewCommentMap.get(c.parent_id) || null : null;
                    const newComment = await comments.create(
                        {
                            file_id: newFileId,
                            user_id: c.user_id || userId,
                            text: c.text || c.message || "",
                            parent_id: newParentId,
                            is_deleted: c.is_deleted !== undefined ? c.is_deleted : false,
                            deleted_at: c.deleted_at || null,
                            is_edited: c.is_edited !== undefined ? c.is_edited : false,
                            edited_at: c.edited_at || null,
                            edit_history: Array.isArray(c.edit_history) ? c.edit_history : [],
                        },
                        { transaction: t }
                    );
                    oldToNewCommentMap.set(c.id, newComment.id);
                }
            }

            // 9. Restore Manuals & Reports
            const manualsList = snapshot.manuals || [];
            for (const m of manualsList) {
                await manuals.create(
                    {
                        project_id: newProjectId,
                        file_name: m.file_name || m.title || "Manual",
                        file_url: m.file_url,
                        file_size_mb: m.file_size_mb !== undefined ? m.file_size_mb : 0,
                        type: m.type || "manual",
                        uploaded_by: m.uploaded_by || userId,
                    },
                    { transaction: t }
                );
            }

            const reportsList = snapshot.reports || [];
            for (const r of reportsList) {
                await reports.create(
                    {
                        project_id: newProjectId,
                        type: r.type || "daily",
                        period_start: r.period_start || new Date().toISOString().split('T')[0],
                        period_end: r.period_end || new Date().toISOString().split('T')[0],
                        photos_count: r.photos_count || 0,
                        docs_count: r.docs_count || 0,
                        releases_count: r.releases_count || 0,
                        comments_count: r.comments_count || 0,
                        summary: r.summary || null,
                    },
                    { transaction: t }
                );
            }

            // 10. Restore Project Members & Folder Permissions
            const membersList = snapshot.members || [];
            for (const mem of membersList) {
                const newMember = await project_members.create(
                    {
                        project_id: newProjectId,
                        user_id: mem.user_id,
                        role: mem.role,
                    },
                    { transaction: t }
                );

                if (Array.isArray(mem.project_member_folders)) {
                    for (const pmf of mem.project_member_folders) {
                        const newFid = oldToNewFolderMap.get(pmf.folder_id);
                        if (newFid) {
                            await project_member_folders.create(
                                {
                                    project_member_id: newMember.id,
                                    folder_id: newFid,
                                },
                                { transaction: t }
                            );
                        }
                    }
                }
            }

            // 11. Remove from archived_projects table
            await archive.destroy({ force: true, transaction: t });

            await t.commit();

            emitStatus("Project successfully restored!", "success", {
                restoredProjectId: newProjectId,
                project: restoredProject,
            });

            return restoredProject;
        } catch (restoreErr) {
            await t.rollback();
            await archive.update({ status: "archived" });
            throw restoreErr;
        }

    } catch (err: any) {
        console.error("restoreProjectArchive error:", err);
        emitStatus(err?.message || "Restoration failed", "failed", { error: err?.message });
        throw err;
    }
};

/**
 * List all archived projects for an organization with presigned download links.
 */
export const getArchivedProjects = async (organizationId: number) => {
    const list = await archived_projects.findAll({
        where: { organization_id: organizationId },
        order: [["archived_at", "DESC"]],
        include: [
            {
                model: users,
                as: "archiver",
                attributes: ["id", "name", "email", "profile_pic"],
            },
        ],
    });

    const finalizedList = await Promise.all(
        list.map(async (item: any) => {
            const json = item.toJSON ? item.toJSON() : item;
            if (json.zip_file_url) {
                try {
                    const getCmd = new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: json.zip_file_url,
                    });
                    json.download_url = await getSignedUrl(s3Client, getCmd, { expiresIn: 7 * 24 * 3600 });
                } catch (e) {
                    json.download_url = null;
                }
            }
            return json;
        })
    );

    return finalizedList;
};

/**
 * Get presigned download URL for an archived project zip.
 */
export const getArchiveDownloadUrl = async (archiveId: number, organizationId: number) => {
    const item = await archived_projects.findOne({
        where: { id: archiveId, organization_id: organizationId },
    });

    if (!item || !item.zip_file_url) {
        throw new Error("Archive zip not found");
    }

    const getCmd = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: item.zip_file_url,
    });

    return await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });
};

/**
 * Permanently delete an archive from DB and S3.
 */
export const deleteArchivedProjectPermanently = async (archiveId: number, organizationId: number) => {
    const item = await archived_projects.findOne({
        where: { id: archiveId, organization_id: organizationId },
    });

    if (!item) {
        throw new Error("Archive not found");
    }

    if (item.zip_file_url) {
        try {
            await s3Client.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: item.zip_file_url,
                })
            );
        } catch (s3Err) {
            console.error("Failed to delete archive S3 zip:", s3Err);
        }
    }

    await item.destroy({ force: true });
    return true;
};
