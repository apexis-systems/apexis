"use client";

import { useState } from "react";
import { TbUpload, TbTrash, TbLoader, TbPhoto } from "react-icons/tb";
import { uploadBlogImage } from "@/services/blogService";

interface ContentImageInputProps {
  label?: string;
  value?: string;
  onChange?: (url: string) => void;
}

export function ContentImageInput({ label = "Cover Image", value = "", onChange }: ContentImageInputProps = {}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const res = await uploadBlogImage(file);
      onChange?.(res.url);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-stone-200 bg-stone-50 h-32 flex items-center justify-center">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChange?.("")}
              className="p-2 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition-colors"
              title="Remove image"
            >
              <TbTrash size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer bg-stone-50/50 hover:bg-stone-50 transition-colors p-3 text-center">
            {uploading ? (
              <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                <TbLoader size={18} className="animate-spin text-stone-700" />
                Uploading image...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <TbPhoto size={22} className="text-stone-400" />
                <span className="text-xs font-semibold text-stone-700">Click to upload image</span>
                <span className="text-[10px] text-stone-400">PNG, JPG, WEBP up to 50MB</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          <div className="flex items-center gap-2 text-xs text-stone-400 my-0.5">
            <div className="h-px bg-stone-200 flex-1" />
            <span>or paste URL</span>
            <div className="h-px bg-stone-200 flex-1" />
          </div>

          <input
            type="url"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>
      )}

      {error && <span className="text-xs text-red-600 font-medium">{error}</span>}
    </div>
  );
}

export default ContentImageInput;
