"use client";

import { BlogPreviewPage } from "@/pages/Superadmin/Blogs/BlogPreviewPage";
import { useParams } from "next/navigation";

export default function BlogPreviewRoute() {
    const params = useParams();
    return <BlogPreviewPage id={params?.id as string} />;
}
