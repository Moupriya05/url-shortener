// src/middleware/auth.ts
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/database';
import { sendUnauthorized } from '../utils/response';
import { AuthenticatedRequest, JwtPayload } from '../types';
import logger from '../utils/logger';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string | undefined;

    let userId: string | null = null;

    // ─── JWT Auth ──────────────────────────────────────────────────────────
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
        userId = decoded.userId;
      } catch {
        sendUnauthorized(res, 'Invalid or expired token');
        return;
      }
    }

    // ─── API Key Auth ──────────────────────────────────────────────────────
    else if (apiKey) {
      const user = await prisma.user.findUnique({
        where: { apiKey },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          apiKey: true,
        },
      });

      if (!user || !user.isActive) {
        sendUnauthorized(res, 'Invalid API key');
        return;
      }

      req.user = user;
      next();
      return;
    } else {
      sendUnauthorized(res, 'No authentication credentials provided');
      return;
    }

    // Fetch user from DB (JWT path)
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          apiKey: true,
        },
      });

      if (!user || !user.isActive) {
        sendUnauthorized(res, 'User not found or deactivated');
        return;
      }

      req.user = user;
      next();
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    sendUnauthorized(res, 'Authentication failed');
  }
};

// Optional auth — attaches user if present but doesn't block
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          apiKey: true,
        },
      });
      if (user?.isActive) req.user = user;
    }
  } catch {
    // Silently fail for optional auth
  }
  next();
};
