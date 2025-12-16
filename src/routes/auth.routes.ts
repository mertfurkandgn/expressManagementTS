import { Router } from "express";
import { login, register } from "src/controllers/auth.controller";
import { healthCheck } from "src/controllers/healthcheck.controller";
import { validate } from "src/middlewares/validator.middleware";
import { userLoginValidator, userRegisterValidator } from "src/validators";

const router = Router();

router.post("/register",userRegisterValidator(),validate, register);

router.post("/login",userLoginValidator(),validate, login);


router.get("/", healthCheck);



export default router;