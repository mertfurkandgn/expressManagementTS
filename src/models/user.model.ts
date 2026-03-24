import {
  uuid,
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import type { InferSelectModel } from "drizzle-orm";

export const usersTable = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  avatar: varchar({ length: 512 }).default("https://placehold.co/200x200"),
  username: varchar({ length: 255 }).notNull().unique(),
  email: varchar({ length: 255 }).notNull().unique(),
  fullName: varchar({ length: 255 }),
  password: text().notNull(),
  isEmailVerified: boolean().default(false),
  refreshToken: text(),
  forgotPasswordToken: text(),
  forgotPasswordExpiry: timestamp(),
  emailVerificationToken: text(),
  role: varchar({length:32}).notNull().default("member"),
  emailVerificationExpiry: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export type User = InferSelectModel<typeof usersTable>;
