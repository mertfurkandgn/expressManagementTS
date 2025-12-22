import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "src/utils/async-handler";
import { ApiError } from "src/utils/api-error";
import { getUserById } from "src/utils/users";
import { JwtPayload } from "jsonwebtoken";

interface CustomJwtPayload extends JwtPayload {
  id: string;
}

export const verifyJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    try {
      const decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET!,
      ) as CustomJwtPayload;

      const user = await getUserById(decodedToken.id);

      if (!user) {
        throw new ApiError(401, "Invalid access token");
      }

      req.user = user;
      next();
    } catch (error) {
      throw new ApiError(401, "Invalid access token");
    }
  },
);
