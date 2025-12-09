import {
  uuid,
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

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
  emailVerificationExpiry: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});
