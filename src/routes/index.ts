import { Router } from "express";
import healthRoutes from "./healthcheck.routes";
import authRoutes from "./auth.routes";
const router = Router();

router.use("/health", healthRoutes);

router.use("/auth", authRoutes);


export default router;
