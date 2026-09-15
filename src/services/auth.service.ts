// src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { config } from '../config';
import { RegisterDto, LoginDto, JwtPayload } from '../types';
import { AppError } from '../middleware/errorHandler';

export class AuthService {
  // ─── Register ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const apiKey = `sk_${uuidv4().replace(/-/g, '')}`;

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        apiKey,
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        apiKey: true,
        createdAt: true,
      },
    });

    const token = this.signToken({ userId: user.id, email: user.email, plan: user.plan });
    return { user, token };
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive)
      throw new AppError('Invalid email or password', 401);

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new AppError('Invalid email or password', 401);

    const token = this.signToken({ userId: user.id, email: user.email, plan: user.plan });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        apiKey: user.apiKey,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  // ─── Rotate API Key ───────────────────────────────────────────────────────
  async rotateApiKey(userId: string) {
    const apiKey = `sk_${uuidv4().replace(/-/g, '')}`;
    await prisma.user.update({ where: { id: userId }, data: { apiKey } });
    return { apiKey };
  }

  // ─── Get Profile ──────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        apiKey: true,
        createdAt: true,
        _count: { select: { urls: true } }, // removed clicks (no longer on User)
      },
    });
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  private signToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }
}

export const authService = new AuthService();