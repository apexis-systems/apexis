import type { Request, Response } from "express";
import { files, folders, project_members } from "../models/index.ts";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "ap-south-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "apexis-bucket";

// Helper to check access
const checkProjectAccess = async (userId: number, projectId: number) => {
    return await project_members.findOne({
        where: { user_id: userId, project_id: projectId }
    });
};

export const uploadFile = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { file_name, file_type, file_size_mb, folder_id, project_id } = req.body;

        // Ensure contributors have access to this project
        if (authUser.role === "contributor") {
            const access = await checkProjectAccess(authUser.user_id, project_id);
            if (!access || access.role !== "contributor") {
                return res.status(403).json({ error: "Forbidden: Not a contributor to this project" });
            }
        }

        const s3Key = `projects/${project_id}/folders/${folder_id}/${Date.now()}_${file_name}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ContentType: file_type,
        });

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        const newFile = await files.create({
            folder_id,
            file_url: s3Key, // Storing the KEY instead of the full URL for easier fetching later
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
        const authUser = (req as any).user;
        const { projectId } = req.params;

        // Verify access if contributor or client
        if (authUser.role === "contributor" || authUser.role === "client") {
            const access = await checkProjectAccess(authUser.user_id, Number(projectId));
            if (!access) {
                return res.status(403).json({ error: "Forbidden: No access to this project" });
            }
        }

        const folderData = await folders.findAll({
            where: { project_id: projectId },
            include: [
                {
                    model: files,
                    as: "files"
                }
            ]
        });

        // Loop through folders and files to assign presigned GET URLs
        const result = await Promise.all(folderData.map(async (folderObj: any) => {
            const folder = folderObj.toJSON();
            if (folder.files && folder.files.length > 0) {
                folder.files = await Promise.all(folder.files.map(async (file: any) => {
                    const command = new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: file.file_url // The S3 Key
                    });
                    file.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                    return file;
                }));
            }
            return folder;
        }));

        res.status(200).json({ folderData: result });
    } catch (error) {
        console.error("List Files Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteFile = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { fileId } = req.params;

        // Only admins and superadmins can delete
        if (authUser.role !== "admin" && authUser.role !== "superadmin") {
            return res.status(403).json({ error: "Only admins can delete files" });
        }

        const file = await files.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.file_url
        });

        await s3Client.send(command);
        await file.destroy();

        res.status(200).json({ message: "File deleted successfully" });
    } catch (error) {
        console.error("Delete File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
