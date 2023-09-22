require("dotenv").config();
import express, { NextFunction, Request, Response } from "express";
const app = express();
import cookieParser from "cookie-parser";
import cors from "cors";
import { ErrorMiddlewareHandler } from "./middleware/error";
import userRouter from "./routes/user.route";

//body parser
app.use(express.json());

//cookie parser
app.use(cookieParser());

//cors cross origin resource sharing
app.use(
  cors({
    origin: process.env.ORIGIN,
  })
);

//routes
app.use("/api", userRouter);

//testing api
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    message: "API is Working",
  });
});

//to all the routes
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});

app.use(ErrorMiddlewareHandler);

export default app;
