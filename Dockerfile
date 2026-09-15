# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production

LABEL maintainer="you@example.com"
LABEL description="Distributed URL Shortener Service"

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev && \
    DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p logs && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/app.js"]