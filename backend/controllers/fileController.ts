import type { Request, Response } from "express";
import { files, folders } from "../models/index.ts";
export const uploadFile = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        // In a real app, this would use the aws-sdk (e.g., S3 client)
        // to generate a signed upload URL.
        // For this boilerplate, we'll return a simulated presigned URL.
        const { file_name, file_type, file_size_mb, folder_id, project_id } = req.body;

        const s3Key = `projects/${project_id}/folders/${folder_id}/${Date.now()}_${file_name}`;
        const presignedUrl = `https://s3.amazonaws.com/my-bucket/${s3Key}?Signature=SIMULATED`;

        // Assuming the client uploads directly to S3 using the URL, we can pre-create 
        // the DB record or wait for a webhook/confirmation. If pre-creating:
        const newFile = await files.create({
            folder_id,
            file_url: s3Key,
            file_name,
            file_type,
            file_size_mb,
            created_by: authUser.user_id,
        });

        res.status(200).json({
            message: "Presigned URL generated",
            uploadUrl: presignedUrl,
            file: newFile
        });
    } catch (error) {
        console.error("Upload File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const listFiles = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // In a real app, verify the user has access to `projectId` here
        // For example, checking ProjectMember table...

        const folderData = await folders.findAll({
            where: { project_id: projectId },
            include: [
                {
                    model: files,
                    as: "files" // Note: as needs to match association definition if used
                }
            ]
        });

        res.status(200).json({ folderData });
    } catch (error) {
        console.error("List Files Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
