import express from "express";
const courseRouter = express.Router();
import { uploadCourse } from "../controllers/course.controller";
import { isAuthenticated } from "../middleware/auth";

courseRouter.post(
  "/create-course",
  isAuthenticated,

  uploadCourse
);

export default courseRouter;
