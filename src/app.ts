import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//Read Json Data
app.use(express.json({ limit: "16kb" }));

//Read Form Data
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(express.static("public"));

// cors configurations
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "http://locahost:5173",
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

export default app;
