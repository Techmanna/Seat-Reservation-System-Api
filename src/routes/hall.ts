import { Router } from "express";
import { HallController } from "../controllers/HallController";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();
const hallController = new HallController();

// Public routes
router.get("/default", hallController.getDefaultHall);
router.get("/", hallController.getHalls);
router.get("/:id", hallController.getHallById);

// Protected routes (Admin only)
router.use(authenticateAdmin);
router.post("/", hallController.createHall);
router.put("/:id", hallController.updateHall);

export default router;
