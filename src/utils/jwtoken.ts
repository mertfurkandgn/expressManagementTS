import jwt from "jsonwebtoken";
import crypto from "crypto";
const refreshExpiry = Number(process.env.REFRESH_TOKEN_EXPIRY) || 604800;
const accessExpiry = Number(process.env.ACCESS_TOKEN_EXPIRY) || 86400;

export function generateAccessToken(
  id: string,
  email: string,
  username: string,
) {
  return jwt.sign({ id, email, username }, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: accessExpiry,
  });
}

export function generateRefreshToken(id: string) {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: refreshExpiry,
  });
}

export function generateTemporaryToken() {
  const unHashedToken = crypto.randomBytes(20).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");

  const tokenExpiry = Date.now() + 20 * 60 * 1000; //20 mins
  return { unHashedToken, hashedToken, tokenExpiry };
}
