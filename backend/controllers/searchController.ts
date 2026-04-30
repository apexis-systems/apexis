import type { Request, Response } from "express";
import { Op } from "sequelize";
import db from "../models/index.ts";
const { projects, files, snags, rfis, project_members, folders } = db;
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const globalSearch = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(200).json({ projects: [], folders: [], docs: [], photos: [], snags: [], rfis: [] });
        }

        const searchQuery = q.trim();
        const orgId = authUser.organization_id;
        const userId = authUser.user_id;
        const role = authUser.role;

        // Base where condition for projects based on user access
        let projectWhere: any = {
            [Op.or]: [
                { name: { [Op.iLike]: `%${searchQuery}%` } },
                { description: { [Op.iLike]: `%${searchQuery}%` } }
            ]
        };

        if (role === 'admin') {
            projectWhere.organization_id = orgId;
        } else if (role !== 'superadmin') {
            // Contributor/Client: Search only within projects they are members of
            const userMemberships = await project_members.findAll({
                where: { user_id: userId, role: role },
                attributes: ['project_id']
            });
            const projectIds = userMemberships.map((pm: any) => pm.project_id);
            projectWhere.id = { [Op.in]: projectIds };
        }

        const projectResults = await projects.findAll({
            where: projectWhere,
            limit: 5,
            order: [['updatedAt', 'DESC']]
        });

        // For files, snags, etc., we search within the projects the user has access to
        let accessibleProjectIds: number[] = [];
        if (role === 'admin') {
            const orgProjects = await projects.findAll({ where: { organization_id: orgId }, attributes: ['id'] });
            accessibleProjectIds = orgProjects.map((p: any) => p.id);
        } else if (role !== 'superadmin') {
            const userMemberships = await project_members.findAll({
                where: { user_id: userId, role: role },
                attributes: ['project_id']
            });
            accessibleProjectIds = userMemberships.map((pm: any) => pm.project_id);
        } else {
            // Superadmin has access to everything
        }

        const commonWhere = role === 'superadmin' ? {} : { project_id: { [Op.in]: accessibleProjectIds } };

        // Search Folders
        const folderResults = await folders.findAll({
            where: {
                ...commonWhere,
                name: { [Op.iLike]: `%${searchQuery}%` }
            },
            include: [{ model: projects, attributes: ['name'] }],
            limit: 5,
            order: [['updatedAt', 'DESC']]
        });

        // Search Files
        const fileResults = await files.findAll({
            where: {
                ...commonWhere,
                file_name: { [Op.iLike]: `%${searchQuery}%` }
            },
            include: [{ model: projects, attributes: ['name'] }],
            limit: 10, // Increased to allow filtering into photos/docs
            order: [['updatedAt', 'DESC']]
        });

        // Search Snags
        const snagResults = await snags.findAll({
            where: {
                ...commonWhere,
                [Op.or]: [
                    { title: { [Op.iLike]: `%${searchQuery}%` } },
                    { description: { [Op.iLike]: `%${searchQuery}%` } }
                ]
            },
            include: [{ model: projects, attributes: ['name'] }],
            limit: 5,
            order: [['updatedAt', 'DESC']]
        });

        // Search RFIs
        const rfiResults = await rfis.findAll({
            where: {
                ...commonWhere,
                [Op.or]: [
                    { title: { [Op.iLike]: `%${searchQuery}%` } },
                    { description: { [Op.iLike]: `%${searchQuery}%` } }
                ]
            },
            include: [{ model: projects, attributes: ['name'] }],
            limit: 5,
            order: [['updatedAt', 'DESC']]
        });

        // Generate presigned URLs for files
        const filesWithUrls = await Promise.all(fileResults.map(async (file: any) => {
            const json = file.toJSON();
            try {
                const command = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.file_url
                });
                json.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            } catch (err) {
                json.downloadUrl = null;
            }
            return json;
        }));

        const photoResults = filesWithUrls.filter(f => f.file_type?.startsWith('image/')).slice(0, 5);
        const docResults = filesWithUrls.filter(f => !f.file_type?.startsWith('image/')).slice(0, 5);

        res.json({
            projects: projectResults,
            folders: folderResults,
            docs: docResults,
            photos: photoResults,
            snags: snagResults,
            rfis: rfiResults
        });

    } catch (error) {
        console.error("Global Search Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
