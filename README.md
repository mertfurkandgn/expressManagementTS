# expressmanagement (Express + TypeScript + PostgreSQL + Drizzle ORM)

Learning project: authentication flows (register/login/refresh/logout), email verification, and password reset on top of a PostgreSQL database.

## Tech

- Node.js + Express
- TypeScript
- PostgreSQL
- Drizzle ORM
- JWT (access/refresh) stored in HttpOnly cookies

## Local development

### 1) Prerequisites

- Node.js (tested with the repo’s `pnpm` setup)
- Docker (for PostgreSQL)

### 2) Install

```bash
pnpm install
```

### 3) Start PostgreSQL

```bash
docker compose up -d
```

### 4) Create DB schema

```bash
pnpm db:push
```

### 5) Configure environment

Copy `.env.example` to `.env` and fill placeholders.

```bash
copy .env.example .env
```

Do not commit your real `.env` values to GitHub.

### 6) Run the server

```bash
pnpm dev
```

Server runs at `http://localhost:8000` by default.

## Auth & API notes

- Login sets two cookies: `accessToken` and `refreshToken`
  - both are `HttpOnly`
  - both are marked `secure: true` (so HTTPS is required in a real browser; if you test locally over plain `http`, you may need to adjust cookie options)
- Refresh token can be provided via `refreshToken` cookie or request body.

## Endpoints

Base: `/auth`

Unsecured:
- `POST /auth/register` (body: `email`, `username`, `password`, `fullName?`)
- `POST /auth/login` (body: `email`, `password`)
- `GET /auth/verify-email/:verificationToken`
- `POST /auth/refresh-token`
- `POST /auth/forgot-password` (body: `email`)
- `POST /auth/reset-password/:resetToken` (body: `newPassword`)

Secured (JWT required via `accessToken` cookie or `Authorization: Bearer ...`):
- `POST /auth/logout`
- `GET /auth/current-user`
- `POST /auth/change-password` (body: `oldPassword`, `newPassword`)
- `POST /auth/resend-email-verification`

Health:
- `GET /health`

## Environment variables

See `.env.example`.

## Security

- This project stores JWTs in HttpOnly cookies (helps reduce XSS token theft).
- Email/password flows require the Mailtrap SMTP credentials in `.env`.

