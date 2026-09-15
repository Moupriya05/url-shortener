// src/services/url.service.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { cacheService } from '../config/redis';
import { config } from '../config';
import { CreateUrlDto, UpdateUrlDto, PaginationQuery } from '../types';
import { generateShortCode, isValidShortCode } from '../utils/shortCode';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const CACHE_PREFIX = 'url:';
const CLICKS_PREFIX = 'clicks:';

export class UrlService {
  // ─── Create Short URL ──────────────────────────────────────────────────────
  async createUrl(dto: CreateUrlDto, userId?: string) {
    let shortCode: string;

    if (dto.customCode) {
      if (!isValidShortCode(dto.customCode))
        throw new AppError('Invalid custom code format', 400);

      const exists = await prisma.url.findUnique({ where: { shortCode: dto.customCode } });
      if (exists) throw new AppError('Custom code already taken', 409);

      shortCode = dto.customCode;
    } else {
      shortCode = await this.generateUniqueCode();
    }

    const expiresAt =
      dto.expiresAt ??
      new Date(Date.now() + config.url.defaultExpiryDays * 24 * 60 * 60 * 1000);

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    const url = await prisma.url.create({
      data: {
        shortCode,
        originalUrl: dto.originalUrl,
        title: dto.title,
        description: dto.description,
        userId,
        isCustom: !!dto.customCode,
        passwordHash,   // renamed from password
        maxClicks: dto.maxClicks,
        expiresAt,
      },
    });

    await this.cacheUrl(shortCode, url.originalUrl);

    logger.info('URL created', { shortCode, userId });
    return this.formatUrl(url);
  }

  // ─── Resolve Short Code → Original URL ────────────────────────────────────
  async resolveUrl(
    shortCode: string,
    password?: string
  ): Promise<{ originalUrl: string; urlId: string; requiresPassword: boolean }> {
    const cached = await cacheService.get<string>(`${CACHE_PREFIX}${shortCode}`);
    if (cached && !password) {
      return { originalUrl: cached, urlId: shortCode, requiresPassword: false };
    }

    const url = await prisma.url.findUnique({ where: { shortCode } });

    if (!url || !url.isActive)
      throw new AppError('Short URL not found', 404);

    if (url.expiresAt && url.expiresAt < new Date())
      throw new AppError('This link has expired', 410);

    if (url.maxClicks !== null) {
      const clickCount = await this.getClickCount(url.id);
      if (clickCount >= url.maxClicks)
        throw new AppError('This link has reached its maximum clicks', 410);
    }

    // Check password using renamed field
    if (url.passwordHash) {
      if (!password) {
        return { originalUrl: '', urlId: url.id, requiresPassword: true };
      }
      const passwordMatch = await bcrypt.compare(password, url.passwordHash);
      if (!passwordMatch) throw new AppError('Incorrect password', 401);
    }

    if (!url.passwordHash) {
      await this.cacheUrl(shortCode, url.originalUrl);
    }

    return { originalUrl: url.originalUrl, urlId: url.id, requiresPassword: false };
  }

  // ─── Get user's URLs ──────────────────────────────────────────────────────
  async getUserUrls(userId: string, query: PaginationQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [urls, total] = await Promise.all([
      prisma.url.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { clicks: true } } },
      }),
      prisma.url.count({ where: { userId } }),
    ]);

    return { urls: urls.map(this.formatUrl), total, page, limit };
  }

  // ─── Get single URL ────────────────────────────────────────────────────────
  async getUrl(shortCode: string, userId: string) {
    const url = await prisma.url.findFirst({
      where: { shortCode, userId },
      include: { _count: { select: { clicks: true } } },
    });

    if (!url) throw new AppError('URL not found', 404);
    return this.formatUrl(url);
  }

  // ─── Update URL ────────────────────────────────────────────────────────────
  async updateUrl(shortCode: string, userId: string, dto: UpdateUrlDto) {
    const url = await prisma.url.findFirst({ where: { shortCode, userId } });
    if (!url) throw new AppError('URL not found', 404);

    const passwordHash =
      dto.password !== undefined
        ? dto.password === null
          ? null
          : await bcrypt.hash(dto.password, 10)
        : undefined;

    const updated = await prisma.url.update({
      where: { shortCode },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(passwordHash !== undefined && { passwordHash }),  // renamed
        ...(dto.maxClicks !== undefined && { maxClicks: dto.maxClicks }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt }),
      },
    });

    await cacheService.del(`${CACHE_PREFIX}${shortCode}`);
    return this.formatUrl(updated);
  }

  // ─── Delete URL ────────────────────────────────────────────────────────────
  async deleteUrl(shortCode: string, userId: string) {
    const url = await prisma.url.findFirst({ where: { shortCode, userId } });
    if (!url) throw new AppError('URL not found', 404);

    await prisma.url.delete({ where: { shortCode } });
    await cacheService.del(`${CACHE_PREFIX}${shortCode}`);
    return { deleted: true };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  private async generateUniqueCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateShortCode(config.url.shortCodeLength);
      const exists = await prisma.url.findUnique({ where: { shortCode: code } });
      if (!exists) return code;
    }
    throw new AppError('Failed to generate unique short code', 500);
  }

  private async cacheUrl(shortCode: string, originalUrl: string): Promise<void> {
    await cacheService.set(`${CACHE_PREFIX}${shortCode}`, originalUrl, config.url.cacheTtl);
  }

  private async getClickCount(urlId: string): Promise<number> {
    const key = `${CLICKS_PREFIX}${urlId}`;
    const cached = await cacheService.get<number>(key);
    if (cached !== null) return cached;

    const count = await prisma.click.count({ where: { urlId } });
    await cacheService.set(key, count, 60);
    return count;
  }

  private formatUrl(url: Record<string, unknown> & { shortCode: string; originalUrl: string }) {
    return {
      ...url,
      shortUrl: `${config.app.baseUrl}/${url.shortCode}`,
      passwordHash: url.passwordHash ? true : false, // Don't expose hash
    };
  }
}

export const urlService = new UrlService();