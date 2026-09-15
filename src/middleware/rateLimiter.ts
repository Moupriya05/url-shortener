// src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../config/redis';
import { config } from '../config';
import { sendError } from '../utils/response';
import { getClientIp } from '../utils/userAgent';
import logger from '../utils/logger';

interface RateLimitOptions {
  windowSeconds: number;
  max: number;
  keyPrefix: string;
  message?: string;
}

export const createRateLimiter = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = getClientIp(req as unknown as Parameters<typeof getClientIp>[0]);
      const key = `rate_limit:${options.keyPrefix}:${ip}`;

      const { allowed, remaining, resetAt } = await cacheService.checkRateLimit(
        key,
        options.max,
        options.windowSeconds
      );

      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetAt);

      if (!allowed) {
        logger.warn('Rate limit exceeded', { ip, key });
        sendError(
          res,
          options.message ?? 'Too many requests. Please try again later.',
          429
        );
        return;
      }

      next();
    } catch (error) {
      // If Redis is down, allow request through (fail open)
      logger.error('Rate limiter error, failing open', { error });
      next();
    }
  };
};

// Pre-configured limiters
export const globalRateLimiter = createRateLimiter({
  windowSeconds: Math.floor(config.rateLimit.windowMs / 1000),
  max: config.rateLimit.maxRequests,
  keyPrefix: 'global',
});

export const createUrlRateLimiter = createRateLimiter({
  windowSeconds: 60,
  max: 10,
  keyPrefix: 'create_url',
  message: 'Too many URLs created. Please wait before creating more.',
});

export const redirectRateLimiter = createRateLimiter({
  windowSeconds: 60,
  max: 200,
  keyPrefix: 'redirect',
  message: 'Too many redirect requests.',
});

export const authRateLimiter = createRateLimiter({
  windowSeconds: 900,   // 15 minutes
  max: 20,
  keyPrefix: 'auth',
  message: 'Too many auth attempts. Please try again later.',
});


