import { Router } from "express";
import { register } from "src/controllers/auth.controller";
import { healthCheck } from "src/controllers/healthcheck.controller";
import { validate } from "src/middlewares/validator.middleware";
import { userRegisterValidator } from "src/validators";

const router = Router();

router.post("/register",userRegisterValidator(),validate, register);

router.get("/", healthCheck);



export default router;