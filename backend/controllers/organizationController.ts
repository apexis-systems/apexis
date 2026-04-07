import type { Request, Response } from "express";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { organizations } from "../models/index.ts";

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
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Name is required" });
        }

        await organizations.update(
            { name },
            { where: { id: orgId } }
        );

        res.status(200).json({ message: "Organization updated successfully" });
    } catch (error) {
        console.error("Update Organization Error:", error);
        res.status(500).json({ error: "Failed to update organization" });
    }
};
