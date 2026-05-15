import { Router } from "express";
import { deleteTrashPermanently, getTrash, restoreTrash } from "../controllers/trashController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

router.use(verifyToken);

router.get("/", getTrash);
router.post("/:type/:id/restore", restoreTrash);
router.delete("/:type/:id", deleteTrashPermanently);

export default router;
