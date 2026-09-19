import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { AuthService } from '../services/authService';

export class AuthController {
  public static async login(req: AuthenticatedRequest, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await AuthService.login(email, password, ipAddress);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(401).json({ success: false, error: err.message || 'Login failed.' });
    }
  }

  public static async me(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
      }
      const user = await AuthService.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User profile not found.' });
      }
      return res.json({ success: true, user });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
