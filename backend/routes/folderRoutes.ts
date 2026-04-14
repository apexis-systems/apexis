import { Router } from "express";
import { createFolder, getFolders, toggleFolderVisibility, bulkUpdateFolders, updateFolder, deleteFolder } from "../controllers/folderController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all folder routes
router.use(verifyToken);

router.post("/create", createFolder);
router.get("/", getFolders);
router.put("/bulk", bulkUpdateFolders);
router.put("/:folderId", updateFolder);
router.delete("/:folderId", deleteFolder);
router.put("/:folderId/visibility", toggleFolderVisibility);


export default router;
