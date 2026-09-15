// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  sendCreated(res, result, 'Account created successfully');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  sendSuccess(res, result, 'Login successful');
});

export const getProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const profile = await authService.getProfile(req.user!.id);
    sendSuccess(res, profile);
  }
);

export const rotateApiKey = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.rotateApiKey(req.user!.id);
    sendSuccess(res, result, 'API key rotated successfully');
  }
);
