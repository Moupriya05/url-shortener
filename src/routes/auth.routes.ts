import { Router } from 'express';
import { register, login, getProfile, rotateApiKey } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../utils/schemas';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();
router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/login',    authRateLimiter, validate(loginSchema),    login);
router.get('/profile',         authenticate, getProfile);
router.post('/rotate-api-key', authenticate, rotateApiKey);
export default router;
