import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  name: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createUrlSchema = z.object({
  originalUrl: z.string().url(),
  customCode: z.string().min(3).max(32).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  password: z.string().min(4).optional(),
  maxClicks: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

export const updateUrlSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  password: z.string().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});
