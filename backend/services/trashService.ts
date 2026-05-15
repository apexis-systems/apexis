import { Op } from "sequelize";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import db, { comments, files, folders, manuals, organizations, project_members, projects, rfis, sequelize, snags, users } from "../models/index.ts";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";

const TRASH_RETENTION_DAYS = 30;

const getDaysRemaining = (deletedAt?: string | Date | null) => {
    if (!deletedAt) return TRASH_RETENTION_DAYS;
    const deletedDate = new Date(deletedAt);
    const expiryDate = new Date(deletedDate);
    expiryDate.setDate(expiryDate.getDate() + TRASH_RETENTION_DAYS);
    const diffTime = expiryDate.getTime() - Date.now();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

const getProjectScope = async (authUser: any, queryOrgId?: string | number) => {
    if (authUser.role === "superadmin" || authUser.role === "admin") {
        const organizationId = queryOrgId || authUser.organization_id || (await users.findByPk(authUser.user_id))?.organization_id;
        const scopedProjects = await projects.findAll({
            where: organizationId ? { organization_id: organizationId } : undefined,
            attributes: ["id", "organization_id"],
            paranoid: false,
            raw: true,
        });

        return {
            projectIds: scopedProjects.map((project: any) => Number(project.id)),
            organizationId: organizationId ? Number(organizationId) : null,
        };
    }

    const memberships = await project_members.findAll({
        where: { user_id: authUser.user_id, role: authUser.role },
        attributes: ["project_id"],
        raw: true,
    });

    return {
        projectIds: memberships.map((membership: any) => Number(membership.project_id)),
        organizationId: authUser.organization_id ? Number(authUser.organization_id) : null,
    };
};

const deleteS3Object = async (key?: string | null) => {
    if (!key) return;
    try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    } catch (error) {
        console.error(`Failed to delete S3 object ${key}:`, error);
    }
};

const decrementOrgStorage = async (organizationId: number | null, sizeToFreeMb: number, transaction: any) => {
    if (!organizationId || sizeToFreeMb <= 0) return;
    await organizations.decrement("storage_used_mb", {
        by: sizeToFreeMb,
        where: { id: organizationId },
        transaction,
    });
};

const restoreFolderAncestors = async (folderId: number, transaction: any) => {
    const chain: any[] = [];
    let currentFolder = await folders.findByPk(folderId, { paranoid: false, transaction });

    while (currentFolder && currentFolder.parent_id) {
        const parentFolder = await folders.findByPk(currentFolder.parent_id, { paranoid: false, transaction });
        if (!parentFolder) break;
        if (parentFolder.deletedAt) {
            chain.unshift(parentFolder);
        }
        currentFolder = parentFolder;
    }

    for (const folder of chain) {
        await folder.restore({ transaction });
    }
};

const restoreFolderTree = async (folderId: number, transaction: any) => {
    await restoreFolderAncestors(folderId, transaction);

    const rootFolder = await folders.findByPk(folderId, { paranoid: false, transaction });
    if (!rootFolder) {
        throw new Error("Folder not found");
    }

    if (rootFolder.deletedAt) {
        await rootFolder.restore({ transaction });
    }

    const restoreChildren = async (parentId: number) => {
        const childFolders = await folders.findAll({
            where: { parent_id: parentId },
            paranoid: false,
            transaction,
        });

        const childFiles = await files.findAll({
            where: { folder_id: parentId },
            paranoid: false,
            transaction,
        });

        for (const childFolder of childFolders) {
            if (childFolder.deletedAt) {
                await childFolder.restore({ transaction });
            }
            await restoreChildren(childFolder.id);
        }

        for (const childFile of childFiles) {
            if (childFile.deletedAt) {
                await childFile.restore({ transaction });
            }
        }
    };

    await restoreChildren(folderId);
};

const collectFolderTree = async (folderId: number, transaction: any) => {
    const folderIds: number[] = [];
    const nestedFiles: any[] = [];

    const walk = async (currentFolderId: number) => {
        folderIds.push(currentFolderId);

        const currentFiles = await files.findAll({
            where: { folder_id: currentFolderId },
            paranoid: false,
            transaction,
        });
        nestedFiles.push(...currentFiles);

        const childFolders = await folders.findAll({
            where: { parent_id: currentFolderId },
            paranoid: false,
            transaction,
        });

        for (const childFolder of childFolders) {
            await walk(childFolder.id);
        }
    };

    await walk(folderId);
    return { folderIds, nestedFiles };
};

export const permanentlyDeleteFileRecord = async (fileId: number) => {
    const transaction = await sequelize.transaction();

    try {
        const file = await files.findByPk(fileId, { paranoid: false, transaction });
        if (!file) throw new Error("File not found");

        const project = file.project_id
            ? await projects.findByPk(file.project_id, { paranoid: false, transaction, attributes: ["organization_id"] })
            : null;

        await deleteS3Object(file.file_url);
        await comments.destroy({ where: { file_id: file.id }, transaction });
        await file.destroy({ force: true, transaction });
        await decrementOrgStorage(project ? Number(project.organization_id) : null, Number(file.file_size_mb || 0), transaction);

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const permanentlyDeleteFolderRecord = async (folderId: number) => {
    const transaction = await sequelize.transaction();

    try {
        const folder = await folders.findByPk(folderId, { paranoid: false, transaction });
        if (!folder) throw new Error("Folder not found");

        const project = await projects.findByPk(folder.project_id, {
            paranoid: false,
            transaction,
            attributes: ["organization_id"],
        });

        const { folderIds, nestedFiles } = await collectFolderTree(folderId, transaction);
        const fileIds = nestedFiles.map((file: any) => file.id);
        const totalSizeMb = nestedFiles.reduce((total: number, file: any) => total + Number(file.file_size_mb || 0), 0);

        for (const file of nestedFiles) {
            await deleteS3Object(file.file_url);
        }

        if (fileIds.length > 0) {
            await comments.destroy({ where: { file_id: { [Op.in]: fileIds } }, transaction });
            await files.destroy({ where: { id: { [Op.in]: fileIds } }, force: true, transaction });
        }

        await folders.destroy({ where: { id: { [Op.in]: folderIds } }, force: true, transaction });
        await decrementOrgStorage(project ? Number(project.organization_id) : null, totalSizeMb, transaction);

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const permanentlyDeleteManualRecord = async (manualId: number) => {
    const transaction = await sequelize.transaction();

    try {
        const record = await manuals.findByPk(manualId, { paranoid: false, transaction });
        if (!record) throw new Error("Manual not found");

        const project = await projects.findByPk(record.project_id, {
            paranoid: false,
            transaction,
            attributes: ["organization_id"],
        });

        await deleteS3Object(record.file_url);
        await record.destroy({ force: true, transaction });
        await decrementOrgStorage(project ? Number(project.organization_id) : null, Number(record.file_size_mb || 0), transaction);

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const permanentlyDeleteRFIRecord = async (rfiId: number) => {
    const transaction = await sequelize.transaction();

    try {
        const record = await rfis.findByPk(rfiId, { paranoid: false, transaction });
        if (!record) throw new Error("RFI not found");

        const project = await projects.findByPk(record.project_id, { paranoid: false, transaction });
        if (project?.deletedAt) throw new Error("Project is already in trash");

        for (const photo of [ ...(Array.isArray(record.photos) ? record.photos : []), ...(Array.isArray(record.response_photos) ? record.response_photos : []) ]) {
            await deleteS3Object(photo);
        }

        await record.destroy({ force: true, transaction });
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const permanentlyDeleteSnagRecord = async (snagId: number) => {
    const transaction = await sequelize.transaction();

    try {
        const record = await snags.findByPk(snagId, { paranoid: false, transaction });
        if (!record) throw new Error("Snag not found");

        const project = await projects.findByPk(record.project_id, { paranoid: false, transaction });
        if (project?.deletedAt) throw new Error("Project is already in trash");

        await deleteS3Object(record.photo_url);
        await deleteS3Object(record.audio_url);
        for (const photo of Array.isArray(record.response_photos) ? record.response_photos : []) {
            await deleteS3Object(photo);
        }

        await record.destroy({ force: true, transaction });
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const restoreTrashItem = async (type: string, id: number) => {
    const transaction = await sequelize.transaction();

    try {
        if (type === "project") {
            const project = await projects.findByPk(id, { paranoid: false, transaction });
            if (!project) throw new Error("Project not found");
            if (!project.deletedAt) throw new Error("Project is not in trash");
            await project.restore({ transaction });
        } else if (type === "folder") {
            await restoreFolderTree(id, transaction);
        } else if (type === "file" || type === "document" || type === "photo") {
            const file = await files.findByPk(id, { paranoid: false, transaction });
            if (!file) throw new Error("File not found");

            if (file.folder_id) {
                const folder = await folders.findByPk(file.folder_id, { paranoid: false, transaction });
                if (folder?.deletedAt) {
                    await restoreFolderTree(folder.id, transaction);
                }
            }

            if (file.deletedAt) {
                await file.restore({ transaction });
            }
        } else if (type === "manual") {
            const record = await manuals.findByPk(id, { paranoid: false, transaction });
            if (!record) throw new Error("Manual not found");
            if (record.deletedAt) {
                await record.restore({ transaction });
            }
        } else if (type === "rfi") {
            const record = await rfis.findByPk(id, { paranoid: false, transaction });
            if (!record) throw new Error("RFI not found");
            if (record.deletedAt) {
                await record.restore({ transaction });
            }
        } else if (type === "snag") {
            const record = await snags.findByPk(id, { paranoid: false, transaction });
            if (!record) throw new Error("Snag not found");
            if (record.deletedAt) {
                await record.restore({ transaction });
            }
        } else {
            throw new Error("Unsupported trash item type");
        }

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const permanentlyDeleteTrashItem = async (type: string, id: number, organizationId?: number | null) => {
    if (type === "project") {
        const { permanentlyDeleteProject } = await import("./projectService.ts");
        await permanentlyDeleteProject(id, Number(organizationId));
        return;
    }
    if (type === "folder") return permanentlyDeleteFolderRecord(id);
    if (type === "file" || type === "document" || type === "photo") return permanentlyDeleteFileRecord(id);
    if (type === "manual") return permanentlyDeleteManualRecord(id);
    if (type === "rfi") return permanentlyDeleteRFIRecord(id);
    if (type === "snag") return permanentlyDeleteSnagRecord(id);
    throw new Error("Unsupported trash item type");
};

export const getTrashItemsForUser = async (authUser: any, queryOrgId?: string | number) => {
    const { projectIds, organizationId } = await getProjectScope(authUser, queryOrgId);
    if (projectIds.length === 0 && authUser.role !== "superadmin" && authUser.role !== "admin") {
        return [];
    }

    const projectWhere =
        authUser.role === "superadmin" || authUser.role === "admin"
            ? {
                  ...(organizationId ? { organization_id: organizationId } : {}),
                  deletedAt: { [Op.ne]: null },
              }
            : {
                  id: { [Op.in]: projectIds },
                  deletedAt: { [Op.ne]: null },
              };

    const deletedProjects = await projects.findAll({
        where: projectWhere,
        paranoid: false,
        include: [{ model: db.organizations, as: "organization", attributes: ["id", "name"] }],
        order: [["deletedAt", "DESC"]],
    });

    const activeProjectIds = await projects.findAll({
        where: {
            id: { [Op.in]: projectIds.length > 0 ? projectIds : [-1] },
            deletedAt: null,
        },
        paranoid: false,
        attributes: ["id", "name", "organization_id"],
        raw: true,
    });

    const activeProjectsById = new Map(activeProjectIds.map((project: any) => [Number(project.id), project]));
    const activeProjectIdList = activeProjectIds.map((project: any) => Number(project.id));

    const [deletedFolders, deletedFiles, deletedManuals, deletedRFIs, deletedSnags] = await Promise.all([
        folders.findAll({
            where: {
                project_id: { [Op.in]: activeProjectIdList.length > 0 ? activeProjectIdList : [-1] },
                deletedAt: { [Op.ne]: null },
            },
            paranoid: false,
            include: [{ model: folders, as: "parent", attributes: ["id", "deletedAt"], paranoid: false, required: false }],
            order: [["deletedAt", "DESC"]],
        }),
        files.findAll({
            where: {
                project_id: { [Op.in]: activeProjectIdList.length > 0 ? activeProjectIdList : [-1] },
                deletedAt: { [Op.ne]: null },
            },
            paranoid: false,
            include: [{ model: folders, attributes: ["id", "name", "deletedAt"], paranoid: false, required: false }],
            order: [["deletedAt", "DESC"]],
        }),
        manuals.findAll({
            where: {
                project_id: { [Op.in]: activeProjectIdList.length > 0 ? activeProjectIdList : [-1] },
                deletedAt: { [Op.ne]: null },
            },
            paranoid: false,
            order: [["deletedAt", "DESC"]],
        }),
        rfis.findAll({
            where: {
                project_id: { [Op.in]: activeProjectIdList.length > 0 ? activeProjectIdList : [-1] },
                deletedAt: { [Op.ne]: null },
            },
            paranoid: false,
            order: [["deletedAt", "DESC"]],
        }),
        snags.findAll({
            where: {
                project_id: { [Op.in]: activeProjectIdList.length > 0 ? activeProjectIdList : [-1] },
                deletedAt: { [Op.ne]: null },
            },
            paranoid: false,
            order: [["deletedAt", "DESC"]],
        }),
    ]);

    const deletedFoldersByParent = new Map<number, any[]>();
    for (const folder of deletedFolders) {
        const parentId = folder.parent_id ? Number(folder.parent_id) : 0;
        const siblings = deletedFoldersByParent.get(parentId) || [];
        siblings.push(folder);
        deletedFoldersByParent.set(parentId, siblings);
    }

    const deletedFilesByFolder = new Map<number, any[]>();
    for (const file of deletedFiles) {
        const folderId = file.folder_id ? Number(file.folder_id) : 0;
        const folderFiles = deletedFilesByFolder.get(folderId) || [];
        folderFiles.push(file);
        deletedFilesByFolder.set(folderId, folderFiles);
    }

    const buildFolderPreview = (folderId: number): any[] => {
        const childFolders = (deletedFoldersByParent.get(folderId) || []).map((childFolder: any) => ({
            id: childFolder.id,
            itemType: "folder",
            name: childFolder.name,
            deletedAt: childFolder.deletedAt,
        }));

        const childFiles = (deletedFilesByFolder.get(folderId) || []).map((childFile: any) => ({
            id: childFile.id,
            itemType: childFile.file_type?.startsWith("image/") ? "photo" : "document",
            name: childFile.file_name,
            deletedAt: childFile.deletedAt,
        }));

        return [...childFolders, ...childFiles].sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    };

    const items = [
        ...deletedProjects.map((project: any) => ({
            id: project.id,
            itemType: "project",
            name: project.name,
            description: project.description,
            deletedAt: project.deletedAt,
            daysRemaining: getDaysRemaining(project.deletedAt),
            projectId: project.id,
            projectName: project.name,
            totalDocs: project.totalDocs || 0,
            totalPhotos: project.totalPhotos || 0,
            canRestore: authUser.role === "admin" || authUser.role === "superadmin",
            canDeleteForever: authUser.role === "admin" || authUser.role === "superadmin",
        })),
        ...deletedFolders
            .filter((folder: any) => !folder.parent || !folder.parent.deletedAt)
            .map((folder: any) => ({
                id: folder.id,
                itemType: "folder",
                name: folder.name,
                description: folder.folder_type === "photo" ? "Photo folder" : "Document folder",
                deletedAt: folder.deletedAt,
                daysRemaining: getDaysRemaining(folder.deletedAt),
                projectId: folder.project_id,
                projectName: activeProjectsById.get(Number(folder.project_id))?.name || "Project",
                itemSubType: folder.folder_type,
                nestedItems: buildFolderPreview(Number(folder.id)).slice(0, 8),
                nestedItemsCount: buildFolderPreview(Number(folder.id)).length,
                canRestore: ["admin", "superadmin", "contributor"].includes(authUser.role),
                canDeleteForever: ["admin", "superadmin", "contributor"].includes(authUser.role),
            })),
        ...deletedFiles
            .filter((file: any) => !file.folder || !file.folder.deletedAt)
            .map((file: any) => ({
                id: file.id,
                itemType: file.file_type?.startsWith("image/") ? "photo" : "document",
                name: file.file_name,
                description: file.folder?.name || null,
                deletedAt: file.deletedAt,
                daysRemaining: getDaysRemaining(file.deletedAt),
                projectId: file.project_id,
                projectName: activeProjectsById.get(Number(file.project_id))?.name || "Project",
                itemSubType: file.file_type,
                canRestore: Number(file.created_by) === Number(authUser.user_id) || ["admin", "superadmin"].includes(authUser.role),
                canDeleteForever: Number(file.created_by) === Number(authUser.user_id) || ["admin", "superadmin"].includes(authUser.role),
            })),
        ...deletedManuals.map((manual: any) => ({
            id: manual.id,
            itemType: "manual",
            name: manual.file_name,
            description: manual.type || "Manual",
            deletedAt: manual.deletedAt,
            daysRemaining: getDaysRemaining(manual.deletedAt),
            projectId: manual.project_id,
            projectName: activeProjectsById.get(Number(manual.project_id))?.name || "Project",
            canRestore: Number(manual.uploaded_by) === Number(authUser.user_id) || ["admin", "superadmin"].includes(authUser.role),
            canDeleteForever: Number(manual.uploaded_by) === Number(authUser.user_id) || ["admin", "superadmin"].includes(authUser.role),
        })),
        ...deletedRFIs.map((rfi: any) => ({
            id: rfi.id,
            itemType: "rfi",
            name: rfi.title,
            description: rfi.description || null,
            deletedAt: rfi.deletedAt,
            daysRemaining: getDaysRemaining(rfi.deletedAt),
            projectId: rfi.project_id,
            projectName: activeProjectsById.get(Number(rfi.project_id))?.name || "Project",
            canRestore: Number(rfi.created_by) === Number(authUser.user_id) || ["admin", "superadmin"].includes(authUser.role),
            canDeleteForever: Number(rfi.created_by) === Number(authUser.user_id) || ["admin", "superadmin"].includes(authUser.role),
        })),
        ...deletedSnags.map((snag: any) => ({
            id: snag.id,
            itemType: "snag",
            name: snag.title,
            description: snag.description || null,
            deletedAt: snag.deletedAt,
            daysRemaining: getDaysRemaining(snag.deletedAt),
            projectId: snag.project_id,
            projectName: activeProjectsById.get(Number(snag.project_id))?.name || "Project",
            canRestore: Number(snag.created_by) === Number(authUser.user_id) || ["admin", "superadmin"].includes(authUser.role),
            canDeleteForever: Number(snag.created_by) === Number(authUser.user_id) || ["admin", "superadmin"].includes(authUser.role),
        })),
    ];

    return items.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
};

export const purgeExpiredTrashItems = async () => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - TRASH_RETENTION_DAYS);

    const [expiredProjects, expiredFolders, expiredFiles, expiredManuals, expiredRFIs, expiredSnags] = await Promise.all([
        projects.findAll({ where: { deletedAt: { [Op.lte]: threshold } }, paranoid: false, attributes: ["id", "organization_id"] }),
        folders.findAll({ where: { deletedAt: { [Op.lte]: threshold } }, paranoid: false, attributes: ["id"] }),
        files.findAll({ where: { deletedAt: { [Op.lte]: threshold } }, paranoid: false, attributes: ["id"] }),
        manuals.findAll({ where: { deletedAt: { [Op.lte]: threshold } }, paranoid: false, attributes: ["id"] }),
        rfis.findAll({ where: { deletedAt: { [Op.lte]: threshold } }, paranoid: false, attributes: ["id"] }),
        snags.findAll({ where: { deletedAt: { [Op.lte]: threshold } }, paranoid: false, attributes: ["id"] }),
    ]);

    for (const project of expiredProjects) {
        await permanentlyDeleteTrashItem("project", Number(project.id), Number(project.organization_id));
    }

    for (const folder of expiredFolders) {
        const parentFolder = await folders.findByPk(folder.id, {
            paranoid: false,
            include: [{ model: folders, as: "parent", attributes: ["id", "deletedAt"], paranoid: false, required: false }],
        });

        if (!parentFolder) continue;
        const parentProject = await projects.findByPk(parentFolder.project_id, { paranoid: false, attributes: ["id", "deletedAt"] });
        if (parentProject?.deletedAt) continue;
        if (parentFolder?.parent?.deletedAt) continue;
        await permanentlyDeleteTrashItem("folder", Number(folder.id));
    }

    for (const file of expiredFiles) {
        const record = await files.findByPk(file.id, {
            paranoid: false,
            include: [{ model: folders, attributes: ["id", "deletedAt"], paranoid: false, required: false }],
        });

        if (!record) continue;
        const parentProject = await projects.findByPk(record.project_id, { paranoid: false, attributes: ["id", "deletedAt"] });
        if (parentProject?.deletedAt) continue;
        if (record?.folder?.deletedAt) continue;
        await permanentlyDeleteTrashItem("file", Number(file.id));
    }

    for (const manual of expiredManuals) {
        const record = await manuals.findByPk(manual.id, { paranoid: false, attributes: ["id", "project_id"] });
        if (!record) continue;
        const parentProject = await projects.findByPk(record.project_id, { paranoid: false, attributes: ["id", "deletedAt"] });
        if (parentProject?.deletedAt) continue;
        await permanentlyDeleteTrashItem("manual", Number(manual.id));
    }

    for (const rfi of expiredRFIs) {
        const record = await rfis.findByPk(rfi.id, { paranoid: false, attributes: ["id", "project_id"] });
        if (!record) continue;
        const parentProject = await projects.findByPk(record.project_id, { paranoid: false, attributes: ["id", "deletedAt"] });
        if (parentProject?.deletedAt) continue;
        await permanentlyDeleteTrashItem("rfi", Number(rfi.id));
    }

    for (const snag of expiredSnags) {
        const record = await snags.findByPk(snag.id, { paranoid: false, attributes: ["id", "project_id"] });
        if (!record) continue;
        const parentProject = await projects.findByPk(record.project_id, { paranoid: false, attributes: ["id", "deletedAt"] });
        if (parentProject?.deletedAt) continue;
        await permanentlyDeleteTrashItem("snag", Number(snag.id));
    }
};
