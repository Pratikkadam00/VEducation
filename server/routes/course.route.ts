import express from "express";
const courseRouter = express.Router();
import { uploadCourse } from "../controllers/course.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";

courseRouter.post(
  "/create-course",
  isAuthenticated,
  authorizeRoles("admin"),
  uploadCourse
);

export default courseRouter;
