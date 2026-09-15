// src/app.ts
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedisClient } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { globalRateLimiter, redirectRateLimiter } from './middleware/rateLimiter';
import { redirect } from './controllers/url.controller';

import authRoutes from './routes/auth.routes';
import urlRoutes from './routes/url.routes';
import healthRoutes from './routes/health.routes';

import logger from './utils/logger';

const app: Application = express();

// ─── Security & Utility Middleware ─────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.app.isDev ? 'dev' : 'combined'));

// ─── Global Rate Limit ─────────────────────────────────────────────────────
app.use('/api', globalRateLimiter);

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);

// ─── Redirect Route (root level: /:shortCode) ──────────────────────────────
app.get('/:shortCode', redirectRateLimiter, redirect);

// ─── 404 Fallback ──────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use(errorHandler);

// ─── Server Bootstrap ──────────────────────────────────────────────────────
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    getRedisClient(); // Initialize Redis connection

    const server = app.listen(config.app.port, () => {
      logger.info(`🚀 Server running on port ${config.app.port}`, {
        env: config.app.env,
        baseUrl: config.app.baseUrl,
      });
    });

    // ─── Graceful Shutdown ──────────────────────────────────────────────────
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        logger.info('Server closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30_000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled promise rejection', { reason });
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();

export default app;
