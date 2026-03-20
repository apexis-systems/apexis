import express from 'express';
import { getOverview } from '../controllers/analyticsController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';

const router = express.Router();

router.get('/', verifyToken, getOverview);

export default router;
