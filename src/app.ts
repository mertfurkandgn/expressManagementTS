import express, { Request, Response } from "express";
import cors from "cors";

const app = express();

//Read Json Data
app.use(express.json({ limit: "16kb" }));

//Read Form Data
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(express.static("public"));

//CORS Config
// cors configurations
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "http://locahost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/", (_req: Request, res: Response) => {
  res.send("Hello, World!");
});

export default app;
