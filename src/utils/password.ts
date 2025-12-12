import bcrypt from "bcryptjs";

export async function hashPassword(password: string, rounds = 10) {
  if (!password?.trim()) {
    throw new Error("Password is required");
  }

  return await bcrypt.hash(password, rounds);
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
) {
  if (!password?.trim() || !hashedPassword?.trim()) {
    throw new Error("Undefined password.");
  }

  return await bcrypt.compare(password, hashedPassword);
}
