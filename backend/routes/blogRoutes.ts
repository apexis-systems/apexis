import { Router } from 'express';
import multer from 'multer';
import { verifyToken, isSuperAdmin } from '../middleware/verifyToken.ts';
import {
    listBlogs,
    getBlog,
    createBlog,
    updateBlog,
    deleteBlog,
    uploadBlogImage,
    uploadBlogVideo,
    getBlogMedia,
} from '../controllers/blogController.ts';

const router = Router();

const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const videoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// Public media proxy route (no auth required for public image display)
router.get('/media', getBlogMedia);

// Admin routes require authentication + superadmin status
router.use(verifyToken);
router.use(isSuperAdmin);

router.get('/', listBlogs);
router.get('/:id', getBlog);
router.post('/', createBlog);
router.put('/:id', updateBlog);
router.delete('/:id', deleteBlog);

router.post('/upload-image', imageUpload.single('file'), uploadBlogImage);
router.post('/upload-video', videoUpload.single('file'), uploadBlogVideo);

export default router;

