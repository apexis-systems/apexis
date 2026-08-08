import { Router } from 'express';
import { listPublishedBlogs, getBlogBySlug } from '../controllers/blogController.ts';

const router = Router();

// Public routes (no authentication required)
router.get('/', listPublishedBlogs);
router.get('/:slug', getBlogBySlug);

export default router;
