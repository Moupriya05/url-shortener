import dotenv from 'dotenv';
dotenv.config();

export const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV !== 'production',
    port: parseInt(process.env.PORT || '3000'),
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    name: process.env.APP_NAME || 'url-shortener',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'changeme',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
  url: {
    shortCodeLength: parseInt(process.env.SHORT_CODE_LENGTH || '7'),
    cacheTtl: parseInt(process.env.URL_CACHE_TTL || '3600'),
    defaultExpiryDays: parseInt(process.env.DEFAULT_URL_EXPIRY_DAYS || '365'),
  },
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
  },
};
