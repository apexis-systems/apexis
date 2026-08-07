import type { Request, Response } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Op } from 'sequelize';
import { blogs, users } from '../models/index.ts';

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const BUCKET = process.env.S3_BUCKET_NAME || 'apexis-bucket';
const REGION = process.env.AWS_REGION || 'ap-south-2';

export function slugify(text: string): string {
    return (text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(proposedSlug: string | undefined, title: string, currentId?: number): Promise<string> {
    let baseSlug = proposedSlug ? slugify(proposedSlug) : slugify(title);
    if (!baseSlug) baseSlug = 'untitled-blog';
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const where: any = { slug };
        if (currentId) {
            where.id = { [Op.ne]: currentId };
        }
        const existing = await blogs.findOne({ where, paranoid: false });
        if (!existing) break;
        counter++;
        slug = `${baseSlug}-${counter}`;
    }
    return slug;
}

function normalizeBlogMediaUrl(str: any, req?: Request): string | null {
    if (!str || typeof str !== 'string') return null;
    const host = req ? `${req.protocol}://${req.get('host')}` : (process.env.PUBLIC_API_URL || 'http://localhost:5002');
    const apiBase = `${host}/api/blogs/media?key=`;

    let result = str;

    // Convert relative media URLs to full backend URLs
    result = result.replace(/(?:src=["'])?\/api\/blogs\/media\?key=([^"'\s>]+)/g, (match, key) => {
        const fullUrl = `${apiBase}${key}`;
        return match.startsWith('src=') ? `src="${fullUrl}"` : fullUrl;
    });

    // Convert direct S3 URLs to full backend media proxy URLs
    const s3Regex = /https:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com\/(blogs\/[^\s"']+)/g;
    result = result.replace(s3Regex, (match, key) => `${apiBase}${encodeURIComponent(key)}`);

    return result;
}

function formatBlogResponse(record: any, req?: Request) {
    if (!record) return null;
    const json = typeof record.toJSON === 'function' ? record.toJSON() : record;

    let contentBlocks = json.contentBlocks || json.content_blocks || [];
    if (Array.isArray(contentBlocks)) {
        contentBlocks = contentBlocks.map((block: any) => {
            if (block && typeof block.html === 'string') {
                return { ...block, html: normalizeBlogMediaUrl(block.html, req) };
            }
            return block;
        });
    }

    return {
        ...json,
        contentBlocks,
        metaTitle: json.metaTitle || json.meta_title || null,
        metaDescription: json.metaDescription || json.meta_description || null,
        authorName: json.authorName || json.author_name || 'APEXIS',
        authorRole: json.authorRole || json.author_role || null,
        authorAvatar: normalizeBlogMediaUrl(json.authorAvatar || json.author_avatar, req),
        coverImage: normalizeBlogMediaUrl(json.coverImage || json.cover_image, req),
        readTime: json.readTime || json.read_time || '1 min read',
        publishedAt: json.publishedAt || json.published_at || null,
    };
}

/** Admin: List all blogs (Draft + Published) */
export const listBlogs = async (req: Request, res: Response) => {
    try {
        const list = await blogs.findAll({
            order: [['createdAt', 'DESC']],
            include: [{ model: users, as: 'author', attributes: ['id', 'name', 'email'] }],
        });
        res.json(list.map((b: any) => formatBlogResponse(b, req)));
    } catch (err) {
        console.error('listBlogs error:', err);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
};

/** Admin: Get single blog by ID */
export const getBlog = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const record = await blogs.findByPk(id, {
            include: [{ model: users, as: 'author', attributes: ['id', 'name', 'email'] }],
        });
        if (!record) return res.status(404).json({ error: 'Blog post not found' });
        res.json(formatBlogResponse(record, req));
    } catch (err) {
        console.error('getBlog error:', err);
        res.status(500).json({ error: 'Failed to fetch blog' });
    }
};


/** Admin: Create new blog */
export const createBlog = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const {
            title,
            slug,
            excerpt,
            contentBlocks,
            faqs,
            category,
            metaTitle,
            metaDescription,
            authorName,
            authorRole,
            authorAvatar,
            coverImage,
            tags,
            readTime,
            publishedAt,
            status,
        } = req.body;

        if (!title || !excerpt) {
            return res.status(400).json({ error: 'Title and excerpt are required' });
        }

        const finalSlug = await generateUniqueSlug(slug, title);

        const newRecord = await blogs.create({
            title: title.trim(),
            excerpt: excerpt.trim(),
            slug: finalSlug,
            content_blocks: contentBlocks || [],
            faqs: faqs || [],
            category: category || null,
            meta_title: metaTitle || null,
            meta_description: metaDescription || null,
            author_name: authorName || 'APEXIS',
            author_role: authorRole || null,
            author_avatar: authorAvatar || null,
            cover_image: coverImage || null,
            tags: Array.isArray(tags) ? tags : [],
            read_time: readTime || '1 min read',
            published_at: publishedAt || (status === 'Published' ? new Date() : null),
            status: status || 'Draft',
            created_by: authUser?.user_id || authUser?.id || null,
        });

        res.status(201).json(formatBlogResponse(newRecord, req));
    } catch (err) {
        console.error('createBlog error:', err);
        res.status(500).json({ error: 'Failed to create blog' });
    }
};

/** Admin: Update existing blog */
export const updateBlog = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const record = await blogs.findByPk(id);
        if (!record) return res.status(404).json({ error: 'Blog post not found' });

        const {
            title,
            slug,
            excerpt,
            contentBlocks,
            faqs,
            category,
            metaTitle,
            metaDescription,
            authorName,
            authorRole,
            authorAvatar,
            coverImage,
            tags,
            readTime,
            publishedAt,
            status,
        } = req.body;

        let finalSlug = (record as any).slug;
        if (slug || title) {
            finalSlug = await generateUniqueSlug(slug || (record as any).slug, title || (record as any).title, Number(id));
        }

        await record.update({
            ...(title !== undefined && { title: title.trim() }),
            ...(excerpt !== undefined && { excerpt: excerpt.trim() }),
            slug: finalSlug,
            ...(contentBlocks !== undefined && { content_blocks: contentBlocks }),
            ...(faqs !== undefined && { faqs }),
            ...(category !== undefined && { category: category || null }),
            ...(metaTitle !== undefined && { meta_title: metaTitle || null }),
            ...(metaDescription !== undefined && { meta_description: metaDescription || null }),
            ...(authorName !== undefined && { author_name: authorName }),
            ...(authorRole !== undefined && { author_role: authorRole || null }),
            ...(authorAvatar !== undefined && { author_avatar: authorAvatar || null }),
            ...(coverImage !== undefined && { cover_image: coverImage || null }),
            ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : [] }),
            ...(readTime !== undefined && { read_time: readTime }),
            ...(publishedAt !== undefined && { published_at: publishedAt }),
            ...(status !== undefined && { status }),
        });

        res.json(formatBlogResponse(record, req));
    } catch (err) {
        console.error('updateBlog error:', err);
        res.status(500).json({ error: 'Failed to update blog' });
    }
};

/** Admin: Soft delete blog */
export const deleteBlog = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const record = await blogs.findByPk(id);
        if (!record) return res.status(404).json({ error: 'Blog post not found' });

        await record.destroy();
        res.json({ message: 'Blog deleted successfully' });
    } catch (err) {
        console.error('deleteBlog error:', err);
        res.status(500).json({ error: 'Failed to delete blog' });
    }
};

/** Public: Stream blog media (bypasses private S3 bucket 403 Forbidden) */
export const getBlogMedia = async (req: Request, res: Response) => {
    try {
        let key = (req.query.key as string) || '';
        if (!key) return res.status(400).json({ error: 'Media key required' });

        if (!key.startsWith('blogs/')) {
            key = `blogs/${key.replace(/^\/+/, '')}`;
        }

        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
        });

        const s3Item = await s3.send(command);

        if (s3Item.ContentType) {
            res.setHeader('Content-Type', s3Item.ContentType);
        }
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        if (s3Item.Body) {
            if (typeof (s3Item.Body as any).pipe === 'function') {
                (s3Item.Body as any).pipe(res);
            } else if (typeof (s3Item.Body as any).transformToWebStream === 'function') {
                const webStream = (s3Item.Body as any).transformToWebStream();
                const reader = webStream.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                res.end();
            } else {
                res.status(500).json({ error: 'S3 item body is not a stream' });
            }
        } else {
            res.status(404).json({ error: 'Media not found' });
        }
    } catch (err) {
        console.error('getBlogMedia error:', err);
        res.status(404).json({ error: 'Media not found' });
    }
};

/** Admin: Upload blog image */
export const uploadBlogImage = async (req: Request | any, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Image file required' });

        const sanitizeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `blogs/images/${Date.now()}_${sanitizeName}`;

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: req.file.mimetype,
            Body: req.file.buffer,
        }));

        const host = `${req.protocol}://${req.get('host')}`;
        const mediaUrl = `${host}/api/blogs/media?key=${encodeURIComponent(key)}`;
        res.json({ url: mediaUrl, key });
    } catch (err) {
        console.error('uploadBlogImage error:', err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
};

/** Admin: Upload blog video */
export const uploadBlogVideo = async (req: Request | any, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Video file required' });

        const sanitizeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `blogs/videos/${Date.now()}_${sanitizeName}`;

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: req.file.mimetype,
            Body: req.file.buffer,
        }));

        const host = `${req.protocol}://${req.get('host')}`;
        const mediaUrl = `${host}/api/blogs/media?key=${encodeURIComponent(key)}`;
        res.json({ url: mediaUrl, key });
    } catch (err) {
        console.error('uploadBlogVideo error:', err);
        res.status(500).json({ error: 'Failed to upload video' });
    }
};


/** Public: List published blogs */
export const listPublishedBlogs = async (req: Request, res: Response) => {
    try {
        const list = await blogs.findAll({
            where: { status: 'Published' },
            attributes: [
                'id', 'title', 'excerpt', 'slug', 'category', 'cover_image',
                'author_name', 'author_role', 'author_avatar', 'tags', 'read_time', 'published_at'
            ],
            order: [['published_at', 'DESC'], ['createdAt', 'DESC']],
        });
        res.json(list.map((b: any) => formatBlogResponse(b, req)));
    } catch (err) {
        console.error('listPublishedBlogs error:', err);
        res.status(500).json({ error: 'Failed to fetch published blogs' });
    }
};

/** Public: Get single published blog by slug */
export const getBlogBySlug = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const record = await blogs.findOne({
            where: { slug, status: 'Published' },
        });

        if (!record) return res.status(404).json({ error: 'Blog post not found' });
        res.json(formatBlogResponse(record, req));
    } catch (err) {
        console.error('getBlogBySlug error:', err);
        res.status(500).json({ error: 'Failed to fetch blog post' });
    }
};


