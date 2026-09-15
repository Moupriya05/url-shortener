import { Response } from 'express';

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'Success',
  statusCode = 200,
  meta?: unknown
): void => {
  res.status(statusCode).json({ success: true, message, data, ...(meta ? { meta } : {}) });
};

export const sendCreated = (res: Response, data: unknown, message = 'Created'): void => {
  sendSuccess(res, data, message, 201);
};

export const sendBadRequest = (res: Response, message = 'Bad request'): void => {
  res.status(400).json({ success: false, message });
};

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): void => {
  res.status(401).json({ success: false, message });
};

export const sendError = (res: Response, message = 'Error', statusCode = 500): void => {
  res.status(statusCode).json({ success: false, message });
};

export const buildPaginationMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
