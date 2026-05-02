import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AdminModel } from '../models/Admin';
import { UserModel } from '../models/User';
import { ApiResponse, AuthRequest } from '../types/index';
import config from '../config/environment';

export const authenticateAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      const response: ApiResponse<null> = {
        success: false,
        message: 'Access denied. No token provided.',
        error: 'No token provided'
      };
      res.status(401).json(response);
      return
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;
    const admin = await AdminModel.findById(decoded.id);

    if (!admin) {
      const response: ApiResponse<null> = {
        success: false,
        message: 'Invalid token.',
        error: 'Admin not found'
      };
      res.status(401).json(response);
      return
    }

    req.admin = admin;
    next();
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      message: 'Invalid token.',
      error: 'Token verification failed'
    };
    res.status(401).json(response);
  }
};

export const authenticateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret') as any;
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({
        success: false,
        message: 'Email verification required.'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};