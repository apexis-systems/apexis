"use client";

import { useState, useEffect } from "react";
import { getSecureFileUrl } from "@/services/fileService";
import { User } from "lucide-react";

interface Props {
    fileKey?: string;
    name?: string;
    size?: string;
    className?: string;
}

export default function SecureAvatar({ fileKey, name, size = "h-10 w-10", className = "" }: Props) {
    const [imgUrl, setImgUrl] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;

        const fetchImage = async () => {
            if (!fileKey) return;
            try {
                const url = await getSecureFileUrl(fileKey);
                objectUrl = url;
                setImgUrl(url);
            } catch (err) {
                console.error("Failed to fetch secure avatar", err);
            }
        };

        fetchImage();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [fileKey]);

    if (imgUrl) {
        return (
            <img
                src={imgUrl}
                alt={name || "User avatar"}
                className={`${size} rounded-full object-cover shrink-0 ${className}`}
            />
        );
    }

    return (
        <div className={`${size} rounded-full bg-primary flex items-center justify-center shrink-0 ${className}`}>
            <span className="text-white font-bold text-sm">
                {name ? name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
            </span>
        </div>
    );
}
