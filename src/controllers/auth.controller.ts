import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ApiResponse } from "src/utils/api-response";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import {
  getUserByColumn,
  createUser,
  getUserById,
  updateUserRefreshToken,
  getUserByEmail,
  updateUserById,
  getUserByTokenAndExpiry,
} from "src/utils/users";
import { ApiError } from "src/utils/api-error";
import {
  generateRefreshToken,
  generateAccessToken,
  generateTemporaryToken,
} from "src/utils/jwtoken";
import {
  emailVerificationMailgenContent,
  sendEmail,
  forgotPasswordMailgenContent,
} from "src/utils/mail";
import { comparePassword, hashPassword } from "src/utils/password";

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

  const hashedPassword = await hashPassword(password);
  const userData = {
    email: email,
    username: username,
    password: hashedPassword,
    role: role,
  };

  const user = await createUser(userData);

  const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken();

  const hashedData = {
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: tokenExpiry,
  };

  await updateUserById(hashedData, user.id);

  const verificationUrl = `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`;

  await sendEmail({
    email: user.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      verificationUrl,
    ),
  });

  res.status(201).json(
    new ApiResponse(201, {
      message: "User registered successfully",
      data: user.username,
    }),
  );
});

const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, username } = req.body;
  if (!email) {
    throw new ApiError(400, " email is required");
  }
  const user = await getUserByEmail(email);

  if (!user) {
    throw new ApiError(400, "User does not exists");
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user.id,
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: username,
          accessToken,
          refreshToken,
        },
        "User logged in successfully",
      ),
    );
});

const logout = asyncHandler(async (req: Request, res: Response) => {
  const user = getUserById(req.user.id);
  if (!user) {
    throw new ApiError(400, "User not found.");
  }
  const updateData = { refreshToken: "" };

  const updatedUser = updateUserById(updateData, req.user.id);

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});
const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { verificationToken } = req.params;
  if (!verificationToken) {
    throw new ApiError(400, "Email verification token is missing");
  }
  let hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const user = await getUserByTokenAndExpiry(hashedToken, new Date());
  if (!user) {
    throw new ApiError(400, "Token is invalid or expired");
  }

  const updateData = {
    emailVerificationToken: undefined,
    emailVerificationExpiry: undefined,
    isEmailVerified: true,
  };
  await updateUserById(updateData, user.id);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isEmailVerified: true,
      },
      "Email is verified",
    ),
  );
});
const resendEmailVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await getUserById(req.user?.id);

    if (!user) {
      throw new ApiError(404, "User does not exist");
    }

    if (user.isEmailVerified) {
      throw new ApiError(409, "Email is already verified");
    }

    const { unHashedToken, hashedToken, tokenExpiry } =
      generateTemporaryToken();

    const hashedData = {
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: tokenExpiry,
    };

    await updateUserById(hashedData, user.id);

    await sendEmail({
      email: user.email,
      subject: "Please verify your email",
      mailgenContent: emailVerificationMailgenContent(
        user.username,
        `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`,
      ),
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Mail has been sent to your email ID"));
  },
);
const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized access");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET!,
    );
    if (typeof decodedToken === "string") {
      throw new Error("Invalid token payload");
    }

    const user = await getUserById(decodedToken?.id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token in expired");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user.id);

    const refreshUpdate = { refreshToken: newRefreshToken };

    await updateUserById(refreshUpdate, user.id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed",
        ),
      );
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});

const forgotPasswordRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await getUserByEmail(email);

    if (!user) {
      throw new ApiError(404, "User does not exists", []);
    }

    const { unHashedToken, hashedToken, tokenExpiry } =
      generateTemporaryToken();
    const hashedData = {
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: tokenExpiry,
    };

    await updateUserById(hashedData, user.id);

    await sendEmail({
      email: user?.email,
      subject: "Password reset request",
      mailgenContent: forgotPasswordMailgenContent(
        user.username,
        `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`,
      ),
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {},
          "Password reset mail has been sent on your mail id",
        ),
      );
  },
);

const resetForgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    let hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await getUserByTokenAndExpiry(hashedToken, new Date());

    if (!user) {
      throw new ApiError(489, "Token is invalid or expired");
    }

    const hashedPassword = await hashPassword(newPassword);

    const updateData = {
      emailVerificationToken: undefined,
      emailVerificationExpiry: undefined,
      password: hashedPassword,
    };

    await updateUserById(updateData, user.id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password reset successfully"));
  },
);

const changeCurrentPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    const user = await getUserById(req.user?.id);
    const isPasswordValid = await comparePassword(oldPassword, user.password);

    if (!isPasswordValid) {
      throw new ApiError(400, "Invalid old Password");
    }

    const data = { password: newPassword };
    await updateUserById(data, user.id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"));
  },
);

export {
  register,
  login,
  logout,
  getCurrentUser,
  verifyEmail,
  resendEmailVerification,
  refreshAccessToken,
  forgotPasswordRequest,
  changeCurrentPassword,
  resetForgotPassword,
};
