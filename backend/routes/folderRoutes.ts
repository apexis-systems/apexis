import { Router } from "express";
import { 
    createFolder, 
    getFolders, 
    toggleFolderVisibility, 
    bulkUpdateFolders, 
    updateFolder, 
    deleteFolder,
    setFolderPassword,
    changeFolderPassword,
    verifyFolderPassword,
    removeFolderPassword,
    forgotFolderPasswordReset
} from "../controllers/folderController.ts";
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

router.post("/:folderId/set-password", setFolderPassword);
router.post("/:folderId/change-password", changeFolderPassword);
router.post("/:folderId/verify-password", verifyFolderPassword);
router.post("/:folderId/remove-password", removeFolderPassword);
router.post("/:folderId/forgot-password-reset", forgotFolderPasswordReset);


export default router;
