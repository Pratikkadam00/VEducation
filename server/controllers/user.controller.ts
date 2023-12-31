import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/Errorhandler";
import { catchAsyncError } from "../middleware/catchAsyncError";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
require("dotenv").config();
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { getUserById } from "../services/user.service";
import cloudinary from "cloudinary";

//register user
interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}
export const registrationUser = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      //handle if email is already exist
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email is already exist", 400));
      }

      const user: IRegistrationBody = {
        name,
        email,
        password,
      };
      const activationToken = createActivationToken(user);
      const activationCode = activationToken.activationCode;
      const data = {
        user: { name: user.name },
        activationCode,
      };
      const html = await ejs.render(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );
      try {
        await sendMail({
          email: user.email,
          subject: "Virtual Learning - Account Activation Code",
          template: "activation-mail.ejs",
          data,
        });
        res.status(201).json({
          success: true,
          message: `Please check your email: ${user.name} to activate your account!`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IActivationToken {
  token: string;
  activationCode: number;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000);

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );
  return { token, activationCode };
};

// activate user
interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

export const activateUser = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;
      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      //check if activation code is correct
      if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler("invalid activation code", 400));
      }

      const { name, email, password } = newUser.user;

      //if user already exist
      const existUser = await userModel.findOne({ email });

      if (existUser) {
        return next(new ErrorHandler("Email already exist ", 400));
      }

      const user = await userModel.create({
        name,
        email,
        password,
      });

      res.send(201).json({
        success: true,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Login user
interface ILoginRequest {
  email: string;
  password: string;
}

//log in user handler
export const loginUser = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;

      // If email and password are not filled
      if (!email || !password) {
        return next(new ErrorHandler("Please enter email and password", 400));
      }

      const user = await userModel.findOne({ email }).select("+password");

      // If the email is wrong or the user does not exist
      if (!user) {
        return next(new ErrorHandler("Invalid email", 400));
      }

      const isPasswordMatch = await user.comparePassword(password);

      // If the password does not match
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid password", 400));
      }

      // If user and password are valid, send the token
      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//log out user handler
export const logOutUser = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refresh_token", "", { maxAge: 1 });

      // after logout user delete userId which was saved as cache
      const userId = req.user?._id || "";
      redis.del(userId);

      res.status(200).json({
        success: true,
        message: "Logged out Successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//update access token
export const updateAccessToken = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token as string;
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      const message = "Could not refresh token";
      //refresh token is not valid or expired
      if (!decoded) {
        return next(new ErrorHandler(message, 400));
      }

      const session = await redis.get(decoded.id as string);
      if (!session) {
        return next(new ErrorHandler(message, 400));
      }

      const user = JSON.parse(session);

      const accessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as string,
        {
          expiresIn: "5m",
        }
      );

      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN as string,
        {
          expiresIn: "3d",
        }
      );

      req.user = user;

      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", refreshToken, refreshTokenOptions);

      res.status(200).json({
        status: "success",
        accessToken,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get user info
export const getUserInfo = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const user = await userModel.findById(userId);
      getUserById(userId, res);
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// export const getUserInfo = catchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const userId = req.user?._id;
//       const user = await getUserById(userId,res); // Await the asynchronous operation here
//       if (!user) {
//         return next(new ErrorHandler("User not found", 404));
//       }

//       // Send the user data as a JSON response
//       res.status(200).json({
//         success: true,
//         user: user,
//       });
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 400));
//     }
//   }
// );

//interface/type for auth body
interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}

//social auth
export const socialAuth = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as ISocialAuthBody;
      const user = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ email, name, avatar });
        sendToken(newUser, 200, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//interface for update user info
interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

//update user info
export const updateUserInfo = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email } = req.body as IUpdateUserInfo;
      const userId = req.user?._id;
      const user = await userModel.findById(userId);

      //if email already exist
      if (email && user) {
        const isEmailExist = await userModel.findOne({ email });
        if (isEmailExist) {
          return next(new ErrorHandler("Email Already Exist", 400));
        }
        user.email = email;
      }

      //duplicate name can be added
      if (name && user) {
        user.name = name;
      }

      await user?.save();
      await redis.set(userId, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// update user password
interface IUpdateUserPassword {
  oldPassword: string;
  newPassword: string;
}

export const updateUserPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { oldPassword, newPassword } = req.body as IUpdateUserPassword;

    if (!(oldPassword && newPassword)) {
      return next(
        new ErrorHandler("Please enter a old password and new password", 400)
      );
    }

    const user = await userModel.findById(req.user?._id).select("+password");

    if (user?.password === undefined) {
      return next(new ErrorHandler("Invalid user", 400));
    }

    const isPasswordMatch = await user?.comparePassword(oldPassword);
    // if old password is wrong
    if (!isPasswordMatch) {
      return next(new ErrorHandler("Invalid old Password", 400));
    }

    user.password = newPassword;
    await user.save();

    await redis.set(req.user?._id, JSON.stringify(user));

    res.status(201).json({
      success: true,
      user,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
};

//update profile
interface IUpdateProfile {
  avatar: string;
}

// update profile picture or avatar
export const updateProfilePicture = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { avatar } = req.body as IUpdateProfile;
    const userId = req.user?._id;
    const user = await userModel.findById(userId);

    if (avatar && user) {
      //if user have one avatar call this if block
      if (user?.avatar?.public_id) {
        //first delete the old image
        await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);

        //upload new image
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
          folder: "avatars",
          width: 150,
        });

        user.avatar = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      } else {
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
          folder: "avatars",
          width: 150,
        });

        user.avatar = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }
    }

    //save user avatar
    await user?.save();

    //set user avatar on redis
    await redis.set(userId, JSON.stringify(user));

    //success then send json data
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
};
