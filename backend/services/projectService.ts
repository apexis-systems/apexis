import { projects, files, manuals, snags, rfis, rooms, folders, chat_messages, room_members, project_members, notifications, activities, reports, comments, organizations, sequelize } from "../models/index.ts";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Op } from "sequelize";

export const permanentlyDeleteProject = async (projectId: number, organizationId: number) => {
    const t = await sequelize.transaction();
    try {
        const project = await projects.findOne({ 
            where: { id: projectId, organization_id: organizationId },
            transaction: t,
            paranoid: false 
        });

        if (!project) {
            await t.rollback();
            throw new Error("Project not found");
        }

        // 1. Fetch Assets for S3 Cleanup & Storage Stats
        const projectFiles = await files.findAll({ where: { project_id: projectId }, transaction: t });
        const projectManuals = await manuals.findAll({ where: { project_id: projectId }, transaction: t });
        const projectSnags = await snags.findAll({ where: { project_id: projectId }, transaction: t });
        const projectRFIs = await rfis.findAll({ where: { project_id: projectId }, transaction: t });
        const projectRooms = await rooms.findAll({ where: { project_id: projectId }, transaction: t });
        const roomIds = projectRooms.map((r: any) => r.id);
        const fileIds = projectFiles.map((f: any) => f.id);

        let totalSizeToDeleteMb = 0;

        // --- S3 Cleanup ---
        const allFileUnits = [...projectFiles, ...projectManuals];
        for (const item of allFileUnits) {
            if (item.file_url) {
                try {
                    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: (item as any).file_url }));
                } catch (s3Err) { console.error(`S3 deletion failed for item ${item.id}:`, s3Err); }
            }
            totalSizeToDeleteMb += ((item as any).file_size_mb || 0);
        }

        for (const snag of projectSnags) {
            if (snag.photo_url) {
                try {
                    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: snag.photo_url }));
                } catch (s3Err) { console.error(`S3 deletion failed for snag ${snag.id}:`, s3Err); }
            }
        }

        for (const rfi of projectRFIs) {
            if (rfi.photos && Array.isArray(rfi.photos)) {
                for (const photo of rfi.photos) {
                    try {
                        await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: photo }));
                    } catch (s3Err) { console.error(`S3 deletion failed for RFI photo in RFI ${rfi.id}:`, s3Err); }
                }
            }
        }

        // --- Database Cleanup ---
        if (fileIds.length > 0) {
            await comments.destroy({ where: { file_id: { [Op.in]: fileIds } }, transaction: t });
        }
        await files.destroy({ where: { project_id: projectId }, transaction: t });
        await manuals.destroy({ where: { project_id: projectId }, transaction: t });
        await snags.destroy({ where: { project_id: projectId }, transaction: t });
        await rfis.destroy({ where: { project_id: projectId }, transaction: t });
        await activities.destroy({ where: { project_id: projectId }, transaction: t });
        await notifications.destroy({ where: { project_id: projectId }, transaction: t });
        await reports.destroy({ where: { project_id: projectId }, transaction: t });
        await folders.destroy({ where: { project_id: projectId }, transaction: t });

        if (roomIds.length > 0) {
            await chat_messages.destroy({ where: { room_id: { [Op.in]: roomIds } }, transaction: t });
            await room_members.destroy({ where: { room_id: { [Op.in]: roomIds } }, transaction: t });
            await rooms.destroy({ where: { project_id: projectId }, transaction: t });
        }
        await project_members.destroy({ where: { project_id: projectId }, transaction: t });

        if (totalSizeToDeleteMb > 0) {
            await organizations.decrement('storage_used_mb', {
                by: totalSizeToDeleteMb,
                where: { id: organizationId },
                transaction: t
            });
        }

        await project.destroy({ force: true, transaction: t });
        await t.commit();
        return true;
    } catch (error) {
        if (t) await t.rollback();
        console.error("Permanently Delete Project Service Error:", error);
        throw error;
    }
};
