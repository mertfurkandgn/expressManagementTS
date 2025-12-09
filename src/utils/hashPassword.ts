import bcrypt from "bcryptjs";

export async function hashPassword(password: string, rounds = 10) {
  if (!password?.trim()) {
    throw new Error("Password is required");
  }

  return bcrypt.hash(password, rounds);
}
