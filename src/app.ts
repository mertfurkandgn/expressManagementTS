import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ApiError } from "./utils/api-error";

const app = express();

//Read Json Data
app.use(express.json({ limit: "16kb" }));

//Read Form Data
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(express.static("public"));

// cors configurations
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

//Cookie Parser
app.use(cookieParser());

//import the routes
import routes from "./routes/index";

app.use("/", routes);


// 404: Hiçbir route eşleşmedi
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Not found" });
});
// Error handler - 4 param, en sonda
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }
  // Beklenmeyen hatalar (DB, kod hatası vb.)
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
