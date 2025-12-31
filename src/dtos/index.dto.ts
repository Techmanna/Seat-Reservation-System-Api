import { BookingStatus } from '../types';
import Joi from 'joi';

export const availableSeatsParamsSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/) // e.g. 2025-08-07
    .required()
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format',
      'any.required': 'Date parameter is required',
    }),
});

export const ticketIdParamsSchema = Joi.object({
  ticketId: Joi.string()
    .required(),

});


export const cancelReservationParamsSchema = Joi.object({
  ticketId: Joi.string()
    .required(),
    reservationToken:Joi.string()
    .required(),
});

export const bookingSchema = Joi.object({
  eventDate: Joi.date().iso().required(),
  seatNumbers: Joi.array().items(Joi.number().positive()).min(1).required(),
  seatLabels: Joi.array().items(Joi.string()).min(1).required(),
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).min(10).max(20).required(),
  gender: Joi.string().valid('male', 'female', 'other').required(),
  ageRange: Joi.string().valid('18-25', '26-35', '36-45', '46-55', '55+').required(),
  aboutYourself: Joi.string().trim().max(500).optional().allow(''),
  agreeToTerms: Joi.boolean().valid(true).required()
});

export const adminLoginSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  password: Joi.string().min(6).required()
});


// Custom Joi validator for Monday–Friday dates
const isWeekday = (value: string, helpers: Joi.CustomHelpers) => {
  try {
    const date = new Date(value);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    if (dayOfWeek < 1 || dayOfWeek > 5) {
      return helpers.error('date.weekday', { message: 'Event date must be a Monday to Friday' });
    }
    return value;
  } catch {
    return helpers.error('date.base', { message: 'Event date must be a valid ISO 8601 date string' });
  }
};

// Joi schema for getAllBookings query parameters
export const getAllBookingsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be an integer',
    'number.min': 'Page must be at least 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
  }),
  search: Joi.string().allow('').default('').messages({
    'string.base': 'Search must be a string',
  }),
  status: Joi.string().valid(BookingStatus).optional().messages({
    'any.only': 'Status must be one of: confirmed, cancelled',
  }),
  eventDate: Joi.string().isoDate().custom(isWeekday).optional().messages({
    'date.base': 'Event date must be a valid ISO 8601 date string',
    'date.weekday': 'Event date must be a Monday to Friday',
  }),
  includeFullyBooked: Joi.boolean().optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});


export const createAdminSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Username must be a string',
      'string.empty': 'Username is required',
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username must not exceed 50 characters',
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores'
    }),

  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required'
    }),

  password: Joi.string()
    .min(6)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    }),

  role: Joi.string()
    .valid('admin', 'superadmin')
    .required()
    .messages({
      'any.only': 'Role must be either admin or superadmin'
    }),

  phone: Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    })
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required'
    })
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required(),
  newPassword: Joi.string()
    .required()
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().min(1).required().messages({
    'string.empty': 'Reset token is required'
  }),

  newPassword: Joi.string()
    .min(6)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'New password must be at least 6 characters',
      'string.pattern.base': 'New password must contain at least one lowercase letter, one uppercase letter, and one number'
    })
});

export const updateAdminSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores'
    }),

  email: Joi.string()
    .email()
    .lowercase()
    .optional()
    .messages({
      'string.email': 'Invalid email format'
    }),

  role: Joi.string()
    .valid('admin', 'superadmin')
    .optional(),

  phone: Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),

  isActive: Joi.boolean().optional()
});

export const adminQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be an integer',
    'number.min': 'Page must be greater than 0'
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit must not exceed 100'
  }),

  search: Joi.string().allow('').optional(),

  role: Joi.string().valid('admin', 'superadmin').optional(),

  isActive: Joi.boolean().optional()
});

export const otpVerificationSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(4).pattern(/^\d+$/).required(),
    tempId: Joi.string().uuid().required(),
    reservationToken: Joi.string().required(),
});



