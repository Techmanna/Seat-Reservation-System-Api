import { Router } from "express";
import { BookingPaymentController } from "../controllers/BookingPaymentController";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();
const controller = new BookingPaymentController();

// Verify payment (public/user accessible)
router.post("/verify", controller.verifyPayment.bind(controller));

// Public endpoint to get payment details from base reference
router.get("/details/:reference", controller.getPaymentDetails.bind(controller));

// Proxy checkout link
router.get("/checkout/:reference", controller.checkoutProxy.bind(controller));

// Admin routes
router.use(authenticateAdmin);

router.post("/generate-link", controller.generatePaymentLink.bind(controller));
router.get("/stats", controller.getPaymentStats.bind(controller));
router.get("/hall/:hallId", controller.getHallPayments.bind(controller));

export default router;
