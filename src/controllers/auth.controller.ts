import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ApiResponse } from "src/utils/api-response";
import {
  getUserByColumn,
  createUser,
  getUserById,
  updateUserRefreshToken,
  updateUserByColumn,
} from "src/utils/users";
import { ApiError } from "src/utils/api-error";
import {
  generateRefreshToken,
  generateAccessToken,
  generateTemporaryToken,
} from "src/utils/jwtoken";
import { emailVerificationMailgenContent, sendEmail } from "src/utils/mail";

export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, { message: "Server is running" }));
});

const generateAccessAndRefreshTokens = async (userId: string) => {
  try {
    const user = await getUserById(userId);
    const accessToken = generateAccessToken(userId, user.email, user.username);
    const refreshToken = generateRefreshToken(userId);

    updateUserRefreshToken(userId, refreshToken);
    return { accessToken, refreshToken };
  } catch (error) {}
  throw new ApiError(
    500,
    "Something went wrong while generating access token ",
    [],
  );
};

const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password, role } = req.body;

  const existedUser = await getUserByColumn("email", email);

  if (existedUser) {
    throw new ApiError(409, "existed user", []);
  }

  // Registration logic will go here
  const userData = {
    email: email,
    username: username,
    password: password,
    role: role,
  };

  const user = await createUser(userData);

  
  const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken();

  const hashedData = {
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: tokenExpiry,
  };

  await updateUserByColumn(hashedData, user.id);

  await sendEmail({
    email: user.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      `${req.protocol}://${req.get("host")}/api/v1/users/
        verify-email/${unHashedToken}`,
    ),
  });

  res
    .status(201)
    .json(new ApiResponse(201, { message: "User registered successfully",data:user.username }));
});

export{register};