import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authGuard } from '../middleware/authGuard';
import { requireInternalService } from '../middleware/internalAuth';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.get('/me', authGuard, authController.me);
authRouter.get('/internal/users/:id', requireInternalService, authController.getInternalUser);
authRouter.put('/me', authGuard, authController.updateProfile);
