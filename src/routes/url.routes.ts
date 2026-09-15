import { Router } from 'express';
import {
  createUrl, getMyUrls, getUrl, updateUrl,
  deleteUrl, getUrlAnalytics, getDashboardStats,
} from '../controllers/url.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUrlSchema, updateUrlSchema } from '../utils/schemas';
import { createUrlRateLimiter } from '../middleware/rateLimiter';

const router = Router();
router.post('/',                    optionalAuth, createUrlRateLimiter, validate(createUrlSchema), createUrl);
router.get('/my',                   authenticate, getMyUrls);
router.get('/stats',                authenticate, getDashboardStats);
router.get('/:shortCode',           authenticate, getUrl);
router.put('/:shortCode',           authenticate, validate(updateUrlSchema), updateUrl);
router.delete('/:shortCode',        authenticate, deleteUrl);
router.get('/:shortCode/analytics', authenticate, getUrlAnalytics);
export default router;
