"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TbArticle, TbPlus, TbTrash, TbExternalLink, TbClock } from "react-icons/tb";
import { cn } from "@/lib/utils";
import { getBlogs, deleteBlog } from "@/services/blogService";
import type { Blog } from "./BlogEditor/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://apexis.in";

export function BlogsManager() {
    const router = useRouter();
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBlogs = useCallback(async () => {
        try {
            const data = await getBlogs();
            setBlogs(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBlogs();
    }, [fetchBlogs]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this blog post?")) return;
        try {
            await deleteBlog(id);
            fetchBlogs();
        } catch {
            alert("Delete failed");
        }
    };

    return (
        <main className="flex h-full min-h-0 w-full flex-col overflow-hidden glass-panel rounded-xl">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-base font-semibold tracking-tight text-gray-900">Blogs</h1>
                        <p className="text-xs text-gray-500">Posts published to the Apexis platform & marketing site.</p>
                    </div>
                </div>
                <button
                    onClick={() => router.push("/superadmin/blogs/new")}
                    className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition-colors"
                >
                    New Blog <TbPlus size={14} />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-1 gap-2">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-16 rounded-xl border border-stone-100 bg-white animate-pulse" />
                        ))
                    ) : blogs.length === 0 ? (
                        <div className="py-20 text-center text-sm text-gray-400">No blogs yet. Create your first post.</div>
                    ) : (
                        blogs.map((blog) => (
                            <div
                                key={blog.id}
                                onClick={() => router.push(`/superadmin/blogs/${blog.id}`)}
                                className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white cursor-pointer hover:bg-stone-50 transition-colors group"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="h-12 w-16 shrink-0 rounded-lg overflow-hidden border border-stone-100 bg-stone-100 flex items-center justify-center">
                                        {(blog.coverImage || (blog as any).cover_image) ? (
                                            <img src={blog.coverImage || (blog as any).cover_image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <TbArticle size={18} className="text-stone-300" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-stone-900 text-sm truncate">{blog.title}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span
                                                className={cn(
                                                    "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border",
                                                    blog.status === "Published"
                                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                        : "bg-amber-50 text-amber-600 border-amber-100"
                                                )}
                                            >
                                                {blog.status}
                                            </span>
                                            {blog.category && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border bg-stone-50 text-stone-500 border-stone-200 truncate">
                                                    {blog.category}
                                                </span>
                                            )}
                                            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-stone-400">
                                                <TbClock size={12} /> {blog.readTime}
                                            </span>
                                            <span className="text-xs text-stone-400 truncate">/{blog.slug}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                    {blog.status === "Published" && (
                                        <a
                                            href={`${SITE_URL}/blogs/${blog.slug}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1.5 text-stone-300 hover:text-stone-700 rounded"
                                            title="View live"
                                        >
                                            <TbExternalLink size={17} />
                                        </a>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(blog.id);
                                        }}
                                        className="p-1.5 text-stone-300 hover:text-red-600 rounded"
                                        title="Delete"
                                    >
                                        <TbTrash size={17} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}

export default BlogsManager;
