import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { usersTable } from "../models/user.model.js";

type UserColumn = "id" | "email" | "username" | "fullName";

export const getUserByColumn = async (column: UserColumn, value: any) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable[column], value))
    .limit(1);

  return user[0] || false;
};
