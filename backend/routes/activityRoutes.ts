import { Router } from 'express';
import { getActivities } from '../controllers/activityController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';

const router = Router();

router.use(verifyToken);
// Base path: /api/activities
router.get('/', getActivities);

export default router;
