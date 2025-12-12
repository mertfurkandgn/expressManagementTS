import jwt from "jsonwebtoken";

const expiry = Number(process.env.ACCESS_TOKEN_EXPIRY) || 86400;

export function generateAccessToken(
  id: string,
  email: string,
  username: string
) {
  return jwt.sign(
    { id, email, username },
    process.env.ACCESS_TOKEN_SECRET!,
    { expiresIn: expiry }
  );
}
