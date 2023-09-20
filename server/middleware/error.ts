import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/Errorhandler";

export const ErrorMiddlewareHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  //wrong mongodb id
  if (err.name === "CastError") {
    const message = `Resource not found. Invalid: ${err.path}`;
    err = new ErrorHandler(message, 400);
  }

  //Duplicate key error
  if (err.code === 11000) {
    const message = `Duplicate ${Object.keys(err.keyValue)} entered`;
    err = new ErrorHandler(message, 400);
  }

  //wrong jwt token
  if (err.name === "JsonWebTokenError") {
    const message = `Json Web Token is invalid try again`;
    err = new ErrorHandler(message, 400);
  }

  //jwt expire
  if (err.name === "TokenExpireError") {
    const message = `Json web token is expired  please try again`;
    err = new ErrorHandler(message, 400);
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};
