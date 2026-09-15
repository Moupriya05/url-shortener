// src/services/analytics.service.ts
import { Request } from 'express';
import { prisma } from '../config/database';
import { parseUserAgent, getClientIp } from '../utils/userAgent';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export class AnalyticsService {
  // ─── Record a Click ────────────────────────────────────────────────────────
  async recordClick(urlId: string, req: Request): Promise<void> {
    try {
      const ipAddress = getClientIp(req as unknown as Parameters<typeof getClientIp>[0]);
      const userAgent = req.headers['user-agent'] ?? '';
      const referer = req.headers['referer'] ?? req.headers['referrer'] ?? undefined;
      const { browser, os, device } = parseUserAgent(userAgent);

      await prisma.click.create({
        data: {
          urlId,
          ipAddress,
          userAgent,
          referer: typeof referer === 'string' ? referer : undefined,
          browser,
          os,
          device,
        },
      });
    } catch (error) {
      logger.error('Failed to record click', { urlId, error });
    }
  }

  // ─── Get Analytics for a URL ───────────────────────────────────────────────
  async getUrlAnalytics(shortCode: string, userId: string, days = 30) {
    const url = await prisma.url.findFirst({
      where: { shortCode, userId },
    });

    if (!url) throw new AppError('URL not found', 404);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const clicks = await prisma.click.findMany({
      where: { urlId: url.id, clickedAt: { gte: since } },
      select: {
        clickedAt: true,
        country: true,
        device: true,
        browser: true,
        os: true,
        referer: true,
        ipAddress: true,
      },
    });

    const totalClicks = await prisma.click.count({ where: { urlId: url.id } });
    const uniqueClicks = await prisma.click.groupBy({
      by: ['ipAddress'],
      where: { urlId: url.id, clickedAt: { gte: since } },
      _count: true,
    });

    return {
      totalClicks,
      uniqueClicks: uniqueClicks.length,
      period: `${days} days`,
      clicksByDate: this.groupByDate(clicks),
      clicksByCountry: this.groupByField(clicks, 'country'),
      clicksByDevice: this.groupByField(clicks, 'device'),
      clicksByBrowser: this.groupByField(clicks, 'browser'),
      clicksByOs: this.groupByField(clicks, 'os'),
      clicksByReferer: this.groupByField(clicks, 'referer'),
    };
  }

  // ─── Dashboard stats for a user ──────────────────────────────────────────
  async getUserStats(userId: string) {
    const [totalUrls, totalClicks, recentClicks] = await Promise.all([
      prisma.url.count({ where: { userId } }),
      prisma.click.count({ where: { url: { userId } } }),
      prisma.click.count({
        where: {
          url: { userId },
          clickedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const topUrls = await prisma.url.findMany({
      where: { userId },
      include: { _count: { select: { clicks: true } } },
      orderBy: { clicks: { _count: 'desc' } },
      take: 5,
    });

    return { totalUrls, totalClicks, recentClicks, topUrls };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────
  private groupByDate(clicks: Array<{ clickedAt: Date }>) {
    const counts: Record<string, number> = {};
    for (const click of clicks) {
      const date = click.clickedAt.toISOString().split('T')[0];
      counts[date] = (counts[date] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private groupByField<T extends Record<string, unknown>>(
    clicks: T[],
    field: keyof T
  ) {
    const counts: Record<string, number> = {};
    for (const click of clicks) {
      const value = (click[field] as string | null) ?? 'Unknown';
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ [field as string]: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

export const analyticsService = new AnalyticsService();