import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  plan: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  apiKey: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateUrlDto {
  originalUrl: string;
  customCode?: string;
  title?: string;
  description?: string;
  password?: string;
  maxClicks?: number;
  expiresAt?: Date;
}

export interface UpdateUrlDto {
  title?: string;
  description?: string;
  isActive?: boolean;
  password?: string | null;
  maxClicks?: number;
  expiresAt?: Date;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
