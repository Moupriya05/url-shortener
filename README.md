# 🔗 Distributed URL Shortener

A production-grade URL shortening service built with **Node.js**, **TypeScript**, **PostgreSQL**, and **Redis** — fully containerised with Docker. Supports user authentication, custom short codes, password-protected links, click analytics, and rate limiting.

---

## 🚀 Live Demo

> Start locally in one command:
> ```bash
> docker compose up --build -d
> ```
> Then open → [http://localhost:3000/health](http://localhost:3000/health)

---

## ✨ Features

- **URL Shortening** — Generate short codes (base-62, 7 characters) or provide a custom alias
- **User Authentication** — JWT-based login and API key support
- **Password-Protected Links** — Secure individual URLs with a password
- **Click Analytics** — Track clicks by date, country, browser, OS, device, and referrer
- **Rate Limiting** — Redis-backed per-IP rate limiting on all endpoints
- **Caching** — Short-code → original URL lookups cached in Redis (TTL configurable)
- **Expiry & Click Limits** — Set a date expiry or max click count per link
- **Graceful Shutdown** — Handles SIGTERM/SIGINT cleanly
- **Health Check Endpoint** — Checks both PostgreSQL and Redis live status
- **Fully Containerised** — One command to run the entire stack with Docker Compose

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Language | TypeScript 5 |
| Framework | Express.js |
| Database | PostgreSQL 16 (via Prisma ORM) |
| Cache / Rate Limiter | Redis 7 (via ioredis) |
| Auth | JWT + API Key |
| Validation | Zod |
| Logging | Winston |
| Containerisation | Docker + Docker Compose |
| Password Hashing | bcryptjs |
| User Agent Parsing | ua-parser-js |

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────┐
│                   Client Request                 │
└────────────────────┬────────────────────────────┘
                     │
              ┌──────▼──────┐
              │  Express.js  │  ← Helmet, CORS, Compression
              │   API Layer  │  ← Morgan logging
              └──────┬───────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
   ┌─────▼────┐ ┌────▼─────┐ ┌──▼──────┐
   │   Auth   │ │   URL    │ │Analytics│
   │Middleware│ │ Service  │ │ Service │
   └─────┬────┘ └────┬─────┘ └──┬──────┘
         │           │           │
         └─────┬─────┘           │
               │                 │
       ┌───────▼───────┐  ┌──────▼──────┐
       │  PostgreSQL   │  │    Redis    │
       │  (Prisma ORM) │  │   Cache     │
       └───────────────┘  └─────────────┘
```

**Request flow for a redirect:**
1. `GET /:shortCode` hits the redirect rate limiter
2. Redis is checked first for a cached mapping
3. On cache miss → PostgreSQL lookup, expiry/click-limit validation
4. Click recorded asynchronously (non-blocking via `setImmediate`)
5. `301` redirect returned to the client

---

## 📁 Project Structure

```
url-shortener/
├── src/
│   ├── app.ts                  # Express app + server bootstrap
│   ├── config/
│   │   ├── index.ts            # Centralised env config
│   │   ├── database.ts         # Prisma client singleton
│   │   └── redis.ts            # Redis client + CacheService
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── url.controller.ts
│   ├── middleware/
│   │   ├── auth.ts             # JWT + API key authentication
│   │   ├── errorHandler.ts     # Global error handler + AppError class
│   │   ├── rateLimiter.ts      # Redis-backed rate limiter factory
│   │   └── validate.ts         # Zod schema validation middleware
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── url.routes.ts
│   │   └── health.routes.ts
│   ├── services/
│   │   ├── auth.service.ts     # Register, login, API key rotation
│   │   ├── url.service.ts      # Create, resolve, update, delete URLs
│   │   └── analytics.service.ts
│   ├── types/
│   │   └── index.ts            # Shared TypeScript interfaces & DTOs
│   └── utils/
│       ├── logger.ts           # Winston logger
│       ├── response.ts         # Standardised JSON response helpers
│       ├── schemas.ts          # Zod validation schemas
│       ├── shortCode.ts        # Base-62 short code generator
│       └── userAgent.ts        # Browser/OS/device parser
├── prisma/
│   └── schema.prisma           # Database schema
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # App + PostgreSQL + Redis
└── .env.example
```

---

## ⚡ Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (that's it — no Node.js needed locally)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/url-shortener.git
cd url-shortener
```

### 2. Create your environment file
```bash
# Mac/Linux
echo 'JWT_SECRET=your_long_random_secret_here' > .env

# Windows (PowerShell)
'JWT_SECRET=your_long_random_secret_here' | Out-File -Encoding utf8 .env
```

### 3. Start everything
```bash
docker compose up --build -d
```
This starts the app, PostgreSQL, and Redis together. First run takes ~3 minutes.

### 4. Initialise the database
```bash
docker compose exec app npx prisma db push
```

### 5. Verify
```bash
curl http://localhost:3000/health
# → {"status":"healthy","checks":{"postgres":"healthy","redis":"healthy"}}
```

---

## 📖 API Reference

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Create a new account |
| POST | `/api/auth/login` | None | Login and get JWT |
| GET | `/api/auth/profile` | JWT | Get your profile |
| POST | `/api/auth/rotate-api-key` | JWT | Rotate your API key |

### URLs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/urls` | Optional | Shorten a URL |
| GET | `/api/urls/my` | JWT | List your URLs |
| GET | `/api/urls/stats` | JWT | Dashboard statistics |
| GET | `/api/urls/:shortCode` | JWT | Get a single URL |
| PUT | `/api/urls/:shortCode` | JWT | Update a URL |
| DELETE | `/api/urls/:shortCode` | JWT | Delete a URL |
| GET | `/api/urls/:shortCode/analytics` | JWT | Click analytics |

### Redirect

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/:shortCode` | None | Redirect to original URL |

### Example Requests

**Register**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Password1","name":"Your Name"}'
```

**Shorten a URL** (no login required)
```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://github.com"}'
```

**Shorten with options**
```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "originalUrl": "https://github.com",
    "customCode": "my-github",
    "password": "secret123",
    "maxClicks": 100,
    "expiresAt": "2025-12-31T00:00:00Z"
  }'
```

---

## 🌍 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment |
| `PORT` | `3000` | Server port |
| `BASE_URL` | `http://localhost:3000` | Used to build short URLs |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password (optional) |
| `JWT_SECRET` | — | Secret key for signing JWTs |
| `JWT_EXPIRES_IN` | `7d` | JWT expiry duration |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `SHORT_CODE_LENGTH` | `7` | Generated short code length |
| `URL_CACHE_TTL` | `3600` | Redis cache TTL (seconds) |
| `DEFAULT_URL_EXPIRY_DAYS` | `365` | Default URL lifespan |
| `ANALYTICS_ENABLED` | `true` | Enable click tracking |

---

## 🗄️ Database Schema

```
User ──< Url ──< Click
```

- **User** — email, hashed password, plan (FREE/PRO/ENTERPRISE), API key
- **Url** — short code, original URL, optional password hash, expiry, click limit
- **Click** — IP, user agent, browser, OS, device, country, referrer, timestamp

---

## 🧹 Useful Commands

```bash
# Stop all containers
docker compose down

# Start again (without rebuilding)
docker compose up -d

# View live app logs
docker compose logs -f app

# Open database GUI (PgAdmin) + Redis Commander
docker compose --profile dev up -d
# PgAdmin  → http://localhost:5050  (admin@admin.com / admin)
# Redis UI → http://localhost:8081

# Wipe all data and start completely fresh
docker compose down -v
```

---

## 🔒 Security Highlights

- Passwords hashed with **bcrypt** (cost factor 12)
- JWTs signed with a configurable secret
- **Helmet.js** sets secure HTTP headers on every response
- Rate limiting on all API routes and redirect endpoint
- Input validated with **Zod** before reaching any service layer
- Prisma parameterised queries prevent SQL injection
- Non-root Docker user in production image

---

## 📊 Key Design Decisions

**Why Redis for rate limiting instead of express-rate-limit?**
A custom Redis implementation works across multiple app instances — essential for horizontal scaling. A memory-based library resets on each pod restart.

**Why cache redirects in Redis?**
The redirect path (`GET /:shortCode`) is the hottest route. Caching the mapping in Redis cuts out a PostgreSQL round-trip for every click on popular links.

**Why async click recording?**
Redirect latency is kept minimal by recording analytics with `setImmediate` — the 301 fires before the database write completes.

---

## 👩‍💻 Author

**Moupriya Sarkar**  
B.Tech in Information Technology — Techno International New Town, Kolkata  
[GitHub](https://github.com/Moupriya05) · [LinkedIn](https://linkedin.com/in/moupriya-sarkar)

---

## 📄 License

MIT — feel free to use and build on this project.
