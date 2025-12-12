import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ApiResponse } from "src/utils/api-response";
import { getUserByColumn } from "src/utils/users";
import { ApiError } from "src/utils/api-error";

export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, { message: "Server is running" }));
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password, role } = req.body;

  const existedUser = await getUserByColumn("email", email);

  if (existedUser) {
    throw new ApiError(409, "existed user", []);
  }

  // Registration logic will go here
  res
    .status(201)
    .json(new ApiResponse(201, { message: "User registered successfully" }));
});
