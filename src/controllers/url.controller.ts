// src/controllers/url.controller.ts
import { Request, Response } from 'express';
import { urlService } from '../services/url.service';
import { analyticsService } from '../services/analytics.service';
import {
  sendSuccess,
  sendCreated,
  buildPaginationMeta,
} from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';
import { config } from '../config';

// ─── Create Short URL ──────────────────────────────────────────────────────
export const createUrl = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const url = await urlService.createUrl(req.body, req.user?.id);
    sendCreated(res, url, 'Short URL created');
  }
);

// ─── List User's URLs ──────────────────────────────────────────────────────
export const getMyUrls = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { urls, total, page, limit } = await urlService.getUserUrls(
      req.user!.id,
      req.query as { page?: number; limit?: number }
    );
    const meta = buildPaginationMeta(page, limit, total);
    sendSuccess(res, urls, 'URLs retrieved', 200, meta);
  }
);

// ─── Get Single URL ────────────────────────────────────────────────────────
export const getUrl = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const url = await urlService.getUrl(req.params.shortCode, req.user!.id);
    sendSuccess(res, url);
  }
);

// ─── Update URL ────────────────────────────────────────────────────────────
export const updateUrl = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const url = await urlService.updateUrl(
      req.params.shortCode,
      req.user!.id,
      req.body
    );
    sendSuccess(res, url, 'URL updated');
  }
);

// ─── Delete URL ────────────────────────────────────────────────────────────
export const deleteUrl = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await urlService.deleteUrl(req.params.shortCode, req.user!.id);
    sendSuccess(res, result, 'URL deleted');
  }
);

// ─── Redirect Handler ──────────────────────────────────────────────────────
export const redirect = asyncHandler(async (req: Request, res: Response) => {
  const { shortCode } = req.params;
  const password = (req.query.password as string | undefined) ||
    req.body?.password as string | undefined;

  const { originalUrl, urlId, requiresPassword } = await urlService.resolveUrl(
    shortCode,
    password
  );

  if (requiresPassword) {
    // Return a simple password prompt page
    res.status(200).send(passwordPage(shortCode));
    return;
  }

  // Record click asynchronously (don't await)
  if (config.analytics.enabled) {
    setImmediate(() => {
      analyticsService.recordClick(urlId, req).catch(() => {});
    });
  }

  res.redirect(301, originalUrl);
});

// ─── URL Analytics ──────────────────────────────────────────────────────────
export const getUrlAnalytics = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const days = parseInt((req.query.days as string) ?? '30', 10);
    const analytics = await analyticsService.getUrlAnalytics(
      req.params.shortCode,
      req.user!.id,
      days
    );
    sendSuccess(res, analytics);
  }
);

// ─── User Dashboard Stats ───────────────────────────────────────────────────
export const getDashboardStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const stats = await analyticsService.getUserStats(req.user!.id);
    sendSuccess(res, stats);
  }
);

// ─── Password Page HTML ────────────────────────────────────────────────────
const passwordPage = (shortCode: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Password Required</title>
  <style>
    body { font-family: system-ui; display: flex; align-items: center; 
           justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .box { background: white; padding: 2rem; border-radius: 8px; 
           box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
    h2 { margin: 0 0 1rem; }
    input { width: 100%; padding: 0.5rem; margin: 0.5rem 0; box-sizing: border-box; 
            border: 1px solid #ccc; border-radius: 4px; }
    button { width: 100%; padding: 0.75rem; background: #2563eb; color: white; 
             border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    button:hover { background: #1d4ed8; }
    .error { color: red; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="box">
    <h2>🔒 Password Required</h2>
    <p>This link is password protected.</p>
    <input type="password" id="pwd" placeholder="Enter password" />
    <button onclick="submit()">Access Link</button>
    <p class="error" id="err" style="display:none">Incorrect password.</p>
  </div>
  <script>
    async function submit() {
      const pwd = document.getElementById('pwd').value;
      const res = await fetch('/${shortCode}?password=' + encodeURIComponent(pwd));
      if (res.redirected) { window.location.href = res.url; }
      else { document.getElementById('err').style.display = 'block'; }
    }
    document.getElementById('pwd').addEventListener('keydown', e => {
      if (e.key === 'Enter') submit();
    });
  </script>
</body>
</html>
`;
