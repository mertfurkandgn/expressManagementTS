# Phase 1 Fixes & Improvements — PRD

---

## PART 1 — CODE REVIEW

### SEVERITY: CRITICAL (app is broken or data is compromised)

---

**BUG 1 — JWT Secret Mismatch: Auth is completely broken**
- File: `src/middlewares/auth.middleware.ts` line 25
- File: `src/utils/jwtoken.ts` lines 9, 15

The middleware verifies tokens with `process.env.JWT_SECRET`, but `generateAccessToken` signs tokens with `process.env.ACCESS_TOKEN_SECRET`. These are two different env vars. **Every authenticated request will fail with "Invalid access token"**. Auth does not work at all.

Fix: Change `auth.middleware.ts:25` from `JWT_SECRET` to `ACCESS_TOKEN_SECRET`.

---

**BUG 2 — Refresh Token signed with the wrong secret**
- File: `src/utils/jwtoken.ts` line 15

`generateRefreshToken` signs with `process.env.ACCESS_TOKEN_SECRET!` but `refreshAccessToken` in `auth.controller.ts:234` verifies with `process.env.REFRESH_TOKEN_SECRET!`. The refresh flow will always throw "Invalid refresh token".

Fix: `jwtoken.ts` line 15 should use `process.env.REFRESH_TOKEN_SECRET!`.

---

**BUG 3 — Refresh Token has the same expiry as Access Token**
- File: `src/utils/jwtoken.ts` line 16

`generateRefreshToken` reuses the same `expiry` constant (derived from `ACCESS_TOKEN_EXPIRY`). Refresh tokens should live much longer (e.g. 7 days).

Fix: Read `REFRESH_TOKEN_EXPIRY` from env and use it in `generateRefreshToken`.

---

**BUG 4 — `changeCurrentPassword` stores PLAINTEXT password in DB**
- File: `src/controllers/auth.controller.ts` line 360

```typescript
const data = { password: newPassword }; // RAW password!
await updateUserById(data, user.id);
```

`hashPassword()` is never called. Anyone who changes their password has it stored in cleartext.

Fix:
```typescript
const hashedPassword = await hashPassword(newPassword);
const data = { password: hashedPassword };
```

---

**BUG 5 — `forgotPasswordRequest` overwrites email verification data**
- File: `src/controllers/auth.controller.ts` lines 291-296

The forgot-password flow saves the token into `emailVerificationToken` / `emailVerificationExpiry` instead of `forgotPasswordToken` / `forgotPasswordExpiry`. The user model has both field pairs. This means:
  - A pending email verification is silently destroyed when a user requests a password reset.
  - `resetForgotPassword` (lines 323-337) also reads/clears `emailVerificationToken` fields.

Fix: Use `forgotPasswordToken` and `forgotPasswordExpiry` in both `forgotPasswordRequest` and `resetForgotPassword`. Create a separate `getUserByForgotToken()` query in `users.ts` that queries the `forgotPasswordToken` column.

---

**BUG 6 — Role escalation: any user can register as admin**
- File: `src/controllers/auth.controller.ts` line 48
- File: `src/validators/index.ts` lines 3-21

```typescript
const { email, username, password, role } = req.body;
```

The `role` field is taken directly from the request body with zero validation. There is no check against `AvailableUserRole`. A user can POST `{"role": "admin"}` and become an admin.

Fix: Either remove `role` from destructuring and hardcode `"member"` for registration, or add `.isIn(AvailableUserRole)` to `userRegisterValidator`.

---

### SEVERITY: HIGH (silent failures, lost data, broken flows)

---

**BUG 7 — Missing `await` in `generateAccessAndRefreshTokens`**
- File: `src/controllers/auth.controller.ts` line 39

```typescript
updateUserRefreshToken(userId, refreshToken); // no await!
```

The refresh token may not be saved to DB before the response is sent. On the next request using that refresh token, the DB comparison (`incomingRefreshToken !== user?.refreshToken`) can fail.

Fix: Add `await`.

---

**BUG 8 — Missing `await` x2 in `logout`**
- File: `src/controllers/auth.controller.ts` lines 134, 140

```typescript
const user = getUserById(req.user.id);       // returns Promise, not user
const updatedUser = updateUserById(updateData, req.user.id); // not awaited
```

`user` is a Promise (always truthy), so the `!user` check never works. The refresh token is never reliably cleared from DB on logout.

Fix: Add `await` to both calls.

---

**BUG 9 — `updateUserById` silently swallows errors**
- File: `src/utils/users.ts` lines 69-74

```typescript
} catch (error) {
  return "error not update user"; // returns a string, callers never check it
}
```

Every caller does `await updateUserById(...)` and ignores the return value. Any DB write failure is completely silent.

Fix: Remove the try-catch and let the error propagate (or throw an `ApiError`).

---

**BUG 10 — `resetForgotPassword` returns HTTP 489**
- File: `src/controllers/auth.controller.ts` line 330

```typescript
throw new ApiError(489, "Token is invalid or expired");
```

489 is not a valid HTTP status code. Should be 400 or 410.

---

**BUG 11 — No global error-handling middleware**
- File: `src/app.ts`

There is no Express error handler `(err, req, res, next)`. When an `ApiError` is thrown:
  - `asyncHandler` calls `next(err)`
  - Express's default handler sends an **HTML** response, not JSON
  - The `statusCode`, `message`, and `errors` fields on `ApiError` are never used

Fix: Add error-handling middleware after routes in `app.ts`:

```typescript
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }
  return res.status(500).json({ success: false, message: "Internal Server Error" });
});
```

---

**BUG 12 — `ACCESS_TOKEN_EXPIRY` read at module load time (before dotenv)**
- File: `src/utils/jwtoken.ts` line 3

```typescript
const expiry = Number(process.env.ACCESS_TOKEN_EXPIRY) || 86400;
```

This runs when the module is first imported. If any file imports `jwtoken.ts` before `dotenv.config()` runs in `server.ts`, `expiry` will always be the fallback `86400` regardless of `.env`.

Fix: Read the env var inside the function, not at module scope.

---

### SEVERITY: MEDIUM (security hygiene, type safety, correctness)

---

**BUG 13 — Hardcoded Mailtrap credentials**
- File: `src/utils/mail.ts` lines 21-22

SMTP user/pass are hardcoded in source code. Even for a learning project this is bad practice — if this repo is ever pushed public, credentials are leaked.

Fix: Move to env vars (`MAILTRAP_USER`, `MAILTRAP_PASS`).

---

**BUG 14 — CORS fallback has a typo: "locahost"**
- File: `src/app.ts` line 18

```typescript
origin: process.env.CORS_ORIGIN?.split(",") || "http://locahost:5173",
```

`locahost` instead of `localhost`. If `CORS_ORIGIN` is not set, CORS will block every frontend request.

---

**BUG 15 — `verifyEmail` sets `undefined` instead of `null`**
- File: `src/controllers/auth.controller.ts` lines 173-174

Drizzle ORM distinguishes between `undefined` (skip this column) and `null` (set to NULL). Setting `undefined` means the token is **never cleared** from the DB.

Fix: Use `null`.

---

**BUG 16 — `req.user` typed as `any`**
- File: `src/types/express.d.ts` line 6

This kills all TypeScript benefits on `req.user`. Define a proper `User` type inferred from the Drizzle schema.

---

**BUG 17 — Login email validator is `optional()`**
- File: `src/validators/index.ts` line 26

```typescript
body("email").optional().isEmail()
```

But `auth.controller.ts:94` throws if `!email`. The validator should enforce email as required.

---

**BUG 18 — `getCurrentUser` route uses POST, should be GET**
- File: `src/routes/auth.routes.ts` line 40

Getting a resource is a read operation. Use `.get()`.

---

**BUG 19 — Login doesn't check `isEmailVerified`**
- File: `src/controllers/auth.controller.ts` lines 92-131

A user who never verified their email can log in and use the app. The `isEmailVerified` column serves no practical purpose right now.

---

**BUG 20 — No password strength validation**
- File: `src/validators/index.ts` line 19

Password only checks `.notEmpty()`. No minimum length, no complexity. Users can set password to a single space (after trim, that becomes empty... which `.notEmpty()` catches, but `"a"` passes).

Fix: Add `.isLength({ min: 8 })` and optionally `.isStrongPassword()`.

---

**BUG 21 — `tsconfig.json` conflicts with `package.json`**
- File: `tsconfig.json` line 4 vs `package.json` line 6

`tsconfig` says `"module": "commonjs"` but `package.json` says `"type": "module"`. `tsx` papers over this at dev time, but building for production will break.

Fix: Change tsconfig to `"module": "ESNext"` and `"moduleResolution": "bundler"`.

---

**BUG 22 — Dead legacy file: `user.models.js` (Mongoose)**
- File: `src/models/user.models.js`

This is a Mongoose model from before the Drizzle migration. It's not imported anywhere but adds confusion. Delete it.

---

**BUG 23 — `CreateUserInput` type used but never defined**
- File: `src/utils/users.ts` line 53

`createUser(data: CreateUserInput)` — `CreateUserInput` is never imported or declared. This likely only compiles because tsx is lenient.

Fix: Use Drizzle's `InferInsertModel` (which is already imported but unused on line 4):
```typescript
type CreateUserInput = InferInsertModel<typeof usersTable>;
```

---

**BUG 24 — `sendEmail` parameter typed as `any`**
- File: `src/utils/mail.ts` line 4

Define an interface: `{ email: string; subject: string; mailgenContent: object }`.

---

**BUG 25 — `@types/*` packages are in `dependencies` instead of `devDependencies`**
- File: `package.json` lines 31-33

Type packages are only needed at build time: `@types/cors`, `@types/jsonwebtoken`, `@types/nodemailer`.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 6     |
| High     | 6     |
| Medium   | 13    |
| **Total**| **25**|

---

---

## PART 2 — TASKS

### Phase 1A: Critical Bug Fixes

- [ ] **Fix JWT secret mismatch**
  - Change `auth.middleware.ts:25` from `JWT_SECRET` to `ACCESS_TOKEN_SECRET`
  - Remove `JWT_SECRET` from `.env` if present
  - **Done when:** Authenticated routes return 200 with a valid token, not 401

- [ ] **Fix refresh token signing**
  - `jwtoken.ts:15`: sign with `REFRESH_TOKEN_SECRET`, use `REFRESH_TOKEN_EXPIRY` for expiry
  - Move env reads inside functions (fixes BUG 12 too)
  - **Done when:** `/auth/refresh-token` returns a new access token successfully

- [ ] **Hash password in `changeCurrentPassword`**
  - Call `hashPassword(newPassword)` before saving
  - **Done when:** After changing password, `SELECT password FROM users` shows a bcrypt hash, not plaintext

- [ ] **Fix forgot-password using wrong DB columns**
  - `forgotPasswordRequest`: write to `forgotPasswordToken` / `forgotPasswordExpiry`
  - `resetForgotPassword`: read/clear `forgotPasswordToken` / `forgotPasswordExpiry`
  - Create `getUserByForgotToken()` in `users.ts`
  - **Done when:** Forgot password flow works without destroying pending email verification

- [ ] **Fix role escalation**
  - Remove `role` from `req.body` destructuring in `register`. Hardcode `role: "member"`
  - OR add `body("role").isIn(AvailableUserRole)` to `userRegisterValidator` and default to `"member"` if not provided
  - **Done when:** POST `/auth/register` with `{"role":"admin"}` results in a `"member"` user

- [ ] **Add `await` to all unawaited async calls**
  - `auth.controller.ts:39` — `await updateUserRefreshToken(...)`
  - `auth.controller.ts:134` — `await getUserById(...)`
  - `auth.controller.ts:140` — `await updateUserById(...)`
  - **Done when:** Logout reliably clears refresh token from DB (query DB to confirm)

---

### Phase 1B: High-Priority Fixes

- [ ] **Add global error-handling middleware**
  - Create error handler in `app.ts` after routes that catches `ApiError`, returns JSON `{ success, message, errors }`
  - For non-ApiError, return generic 500
  - **Done when:** Throwing `new ApiError(400, "test")` from any route returns `{"success":false,"message":"test"}` with status 400

- [ ] **Fix `updateUserById` error handling**
  - Remove try-catch in `users.ts`, let DB errors propagate naturally
  - **Done when:** A constraint violation on update surfaces as a 500 to the client, not silent success

- [ ] **Fix HTTP 489 in `resetForgotPassword`**
  - Change to 400
  - **Done when:** Invalid reset token returns 400, not 489

- [ ] **Fix `verifyEmail` — use `null` instead of `undefined`**
  - Set `emailVerificationToken: null`, `emailVerificationExpiry: null`
  - **Done when:** After email verification, those columns are NULL in DB

- [ ] **Fix CORS typo**
  - `app.ts:18` — `"locahost"` to `"localhost"`

- [ ] **Fix login email validator**
  - Remove `.optional()` from email in `userLoginValidator`
  - **Done when:** POST `/auth/login` without email returns validation error

---

### Phase 1C: Medium-Priority Fixes & Cleanup

- [ ] **Move Mailtrap credentials to `.env`**
  - Add `MAILTRAP_USER`, `MAILTRAP_PASS` to `.env`; read from `process.env` in `mail.ts`
  - **Done when:** `mail.ts` has zero hardcoded credentials

- [ ] **Type `req.user` properly**
  - Infer user type from Drizzle schema: `type User = InferSelectModel<typeof usersTable>`
  - Update `express.d.ts` to use it
  - **Done when:** `req.user.email` autocompletes in the IDE; `req.user.nonexistent` shows a TS error

- [ ] **Define `CreateUserInput` type**
  - `type CreateUserInput = InferInsertModel<typeof usersTable>` in `users.ts`
  - **Done when:** Project compiles without implicit `any` on `createUser`

- [ ] **Type `sendEmail` parameter**
  - Replace `any` with `{ email: string; subject: string; mailgenContent: object }`
  - **Done when:** Calling `sendEmail({})` shows a TS error

- [ ] **Fix `getCurrentUser` route to GET**
  - `auth.routes.ts:40` — `.post()` to `.get()`

- [ ] **Add password strength validation**
  - `.isLength({ min: 8 })` on password validators for register, change-password, reset-password

- [ ] **Add `isEmailVerified` check in login**
  - After finding the user, if `!user.isEmailVerified`, throw `ApiError(403, "Please verify your email first")`
  - **Done when:** Unverified users cannot log in

- [ ] **Fix tsconfig/package.json module conflict**
  - `tsconfig.json`: `"module": "ESNext"`, `"moduleResolution": "bundler"`

- [ ] **Delete `src/models/user.models.js`**
  - Dead Mongoose file. Remove it.

- [ ] **Move `@types/*` packages to devDependencies**
  - `@types/cors`, `@types/jsonwebtoken`, `@types/nodemailer`

---

### Phase 2: New Features

- [ ] **Redis rate limiting on login and forgot-password**
  - Install `express-rate-limit` + `ioredis` + `rate-limit-redis`
  - Add Redis service to `docker-compose.yml` (port 6379)
  - Add `REDIS_URL` to `.env`
  - Create `src/middlewares/rate-limit.middleware.ts` with two limiters:
    - Login: 5 requests per 15 min per IP
    - Forgot-password: 3 requests per 15 min per IP
  - Apply to the two routes in `auth.routes.ts`
  - **Why:** Brute-force protection. Without this, anyone can spam login attempts or flood the email system.
  - **Done when:** 6th login attempt within 15 min returns 429 Too Many Requests

- [ ] **Swagger/OpenAPI documentation**
  - Install `swagger-jsdoc` + `swagger-ui-express`
  - Create `src/config/swagger.ts` with base config
  - Add JSDoc annotations to every route handler
  - Mount `/api-docs` in `app.ts`
  - **Why:** Self-documenting API means the frontend developer (or future you) doesn't need to read source code.
  - **Done when:** `http://localhost:8000/api-docs` shows all endpoints with request/response schemas

- [ ] **Vitest + Supertest test setup**
  - Install `vitest`, `supertest`, `@types/supertest`
  - Create `vitest.config.ts`
  - Create `src/__tests__/auth.test.ts` with tests for:
    - Register (happy path + duplicate email + missing fields)
    - Login (happy path + wrong password + unverified email)
    - Refresh token (happy path + expired token)
    - Logout (happy path + unauthenticated)
  - Use a test DB (separate `DATABASE_URL` for tests)
  - **Why:** Without tests, every code change is a gamble. These 4 flows cover the core auth surface.
  - **Done when:** `pnpm test` runs all tests and they pass

- [ ] **GitHub Actions CI pipeline**
  - Create `.github/workflows/ci.yml`
  - Steps: checkout, pnpm install, lint (`tsc --noEmit`), test (`pnpm test`)
  - Trigger on push and PR to `main`
  - Use service containers for Postgres and Redis
  - **Why:** Catches broken code before it reaches main. Enforces that tests pass.
  - **Done when:** A push to main triggers the workflow, it runs lint + tests, badge is green

- [ ] **Docker Compose update for Redis**
  - Add `redis` service (image `redis:7-alpine`, port 6379, persistent volume)
  - Add health checks for both postgres and redis
  - **Done when:** `docker compose up -d` brings up both postgres and redis; `redis-cli ping` returns PONG

- [ ] **Deploy to Railway + Neon + Upstash**
  - Create `Dockerfile` for the app (multi-stage: build with tsc, run with node)
  - Add `start` script to `package.json`: `node dist/server.js`
  - Provision:
    - **Neon**: free-tier Postgres, get connection string
    - **Upstash**: free-tier Redis, get connection string
    - **Railway**: deploy app, set all env vars
  - Run `drizzle-kit push` against production DB
  - **Why:** A deployed app is a portfolio piece. Railway/Neon/Upstash all have generous free tiers.
  - **Done when:** `curl https://your-app.railway.app/health` returns 200
