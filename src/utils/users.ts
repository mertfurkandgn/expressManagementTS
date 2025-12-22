import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { usersTable } from "../models/user.model.js";
import { InferInsertModel } from "drizzle-orm";

type UserColumn = "id" | "email" | "username" | "fullName";

type CreateUserInput = InferInsertModel<typeof usersTable>;

// get functions
export const getUserByColumn = async (column: UserColumn, value: any) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable[column], value))
    .limit(1);

  return user[0] || false;
};
export const getUserByTokenAndExpiry = async (token: string, expiry: Date) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.emailVerificationToken, token),
        gt(usersTable.emailVerificationExpiry, expiry),
      ),
    )
    .limit(1);

  return user[0] || false;
};

export const getUserById = async (id: string) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  return user[0] || false;
};

export const getUserByEmail = async (email: string) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  return user[0] || false;
};
//insert functions
export const createUser = async (data: CreateUserInput) => {
  const [user] = await db.insert(usersTable).values(data).returning();

  return user;
};

//update functions
export const updateUserRefreshToken = async (
  userId: string,
  refreshToken: string,
) => {
  await db
    .update(usersTable)
    .set({ refreshToken })
    .where(eq(usersTable.id, userId));
};

export const updateUserById = async (data: any, id: string) => {
  try {
    await db.update(usersTable).set(data).where(eq(usersTable.id, id));
  } catch (error) {
    return "error not update user";
  }
};
