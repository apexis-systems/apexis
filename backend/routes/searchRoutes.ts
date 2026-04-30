import { Router } from "express";
import { globalSearch } from "../controllers/searchController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

router.use(verifyToken);

router.get("/global", globalSearch);

export default router;
