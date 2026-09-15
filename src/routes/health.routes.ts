import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { getRedisClient } from '../config/redis';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const start = Date.now();
  let postgresStatus = 'healthy';
  let redisStatus = 'healthy';

  try { await prisma.$queryRaw`SELECT 1`; }
  catch { postgresStatus = 'unhealthy'; }

  try { await getRedisClient().ping(); }
  catch { redisStatus = 'unhealthy'; }

  const status = postgresStatus === 'healthy' && redisStatus === 'healthy'
    ? 'healthy' : 'degraded';

  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    checks: { postgres: postgresStatus, redis: redisStatus },
    uptime: process.uptime(),
    responseTime: Date.now() - start,
  });
});

export default router;
