import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authGuard } from '../middleware/authGuard';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.get('/me', authGuard, authController.me);
