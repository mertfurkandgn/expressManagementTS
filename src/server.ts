import express, { Request, Response } from "express"

const app = express();

const PORT = process.env.PORT ?? 8000;

app.get("/", (_req: Request, res: Response) => {
    res.send("Hello, World!");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});