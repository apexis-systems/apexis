import type { Request, Response } from "express";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { organizations, projects, folders, files, users } from "../models/index.ts";
import { Op } from "sequelize";

export const uploadLogo = async (req: Request | any, res: Response | any) => {
    try {
        const user = (req as any).user;
        if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
            return res.status(403).json({ error: "Access denied" });
        }

        const orgId = user.organization_id;
        if (!orgId) {
            return res.status(400).json({ error: "No organization assigned" });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "No image provided" });
        }


        const extension = file.originalname.split(".").pop();
        const logoKey = `organizations/${orgId}/logo_${Date.now()}.${extension}`;


        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: logoKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        await organizations.update(
            { logo: logoKey },
            { where: { id: orgId } }
        );

        res.status(200).json({ message: "Logo uploaded successfully", logo: logoKey });
    } catch (error) {
        console.error("Organization Logo Upload Error:", error);
        res.status(500).json({ error: "Failed to upload logo" });
    }
};

export const updateOrganization = async (req: Request | any, res: Response | any) => {
    try {
        const user = (req as any).user;
        if (!user || user.role !== "admin") {
            return res.status(403).json({ error: "Access denied" });
        }

        const orgId = user.organization_id;
        const { name, restrict_onboarding } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (restrict_onboarding !== undefined) updateData.restrict_onboarding = restrict_onboarding;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "Nothing to update" });
        }

        await organizations.update(updateData, { where: { id: orgId } });

        const updated = await organizations.findByPk(orgId);
        res.status(200).json({ message: "Organization updated successfully", organization: updated });
    } catch (error) {
        console.error("Update Organization Error:", error);
        res.status(500).json({ error: "Failed to update organization" });
    }
};

export const getOrgPhotos = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (authUser.role !== "admin" && authUser.role !== "superadmin") {
            return res.status(403).json({ error: "Only admins can fetch organization photos" });
        }

        let orgId = authUser.organization_id;
        if (authUser.role === "superadmin" && req.query.organization_id) {
            orgId = parseInt(req.query.organization_id as string, 10) || orgId;
        }

        if (!orgId) {
            return res.status(400).json({ error: "No organization specified" });
        }

        const limit = parseInt(req.query.limit as string, 10) || 40;
        const page = parseInt(req.query.page as string, 10) || 1;
        const offset = (page - 1) * limit;
        const sortDirection = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
        const selectedProjectId = req.query.project_id && req.query.project_id !== 'all'
            ? parseInt(req.query.project_id as string, 10)
            : null;

        // Get projects for this organization
        let projectIds: number[] = [];
        if (selectedProjectId) {
            const proj = await projects.findOne({
                where: { id: selectedProjectId, organization_id: orgId },
                attributes: ["id"]
            });
            if (proj) {
                projectIds = [proj.id];
            }
        } else {
            const orgProjects = await projects.findAll({
                where: { organization_id: orgId },
                attributes: ["id"]
            });
            projectIds = orgProjects.map((p: any) => p.id);
        }

        if (projectIds.length === 0) {
            return res.status(200).json({
                photos: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    totalPages: 0
                }
            });
        }

        // Get all folders for these projects
        const folderData = await folders.findAll({
            where: { project_id: { [Op.in]: projectIds } },
            attributes: ["id"]
        });
        const folderIds = folderData.map((f: any) => f.id);

        const projectOrFolderCond = folderIds.length > 0
            ? {
                [Op.or]: [
                    { project_id: { [Op.in]: projectIds } },
                    { folder_id: { [Op.in]: folderIds } }
                ]
            }
            : { project_id: { [Op.in]: projectIds } };

        const whereCondition: any = {
            [Op.and]: [
                projectOrFolderCond,
                { file_type: { [Op.iLike]: "image/%" } },
                { is_current: true }
            ]
        };

        const totalCount = await files.count({ where: whereCondition });

        const photosList = await files.findAll({
            where: whereCondition,
            limit,
            offset,
            order: [["createdAt", sortDirection]],
            include: [
                {
                    model: users,
                    as: "creator",
                    attributes: ["id", "name", "email"]
                },
                {
                    model: folders,
                    attributes: ["id", "name"]
                },
                {
                    model: projects,
                    attributes: ["id", "name"]
                }
            ]
        });

        // Generate presigned URLs
        const finalizedPhotos = await Promise.all(
            photosList.map(async (file: any) => {
                const fileJson = file.toJSON ? file.toJSON() : file;
                try {
                    const command = new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: fileJson.file_url
                    });
                    fileJson.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                } catch (urlErr) {
                    console.error(`Failed to generate signed URL for key ${fileJson.file_url}:`, urlErr);
                    fileJson.downloadUrl = null;
                }
                return fileJson;
            })
        );

        res.status(200).json({
            photos: finalizedPhotos,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error("Get Org Photos Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
