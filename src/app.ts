import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDB from './config/database';

// Import routes
import bookingRoutes from './routes/booking';
import settingsRoutes from './routes/settings';
import adminRoutes from './routes/admin';
import config from './config/environment';
import appHealth from './routes/AppHealth';
import authRoute from './routes/auth';
import { logger, logRequest } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authenticateAdmin } from './middleware/auth';
import subscriptionRoutes from './routes/subscription.routes';
import eventRoutes from './routes/event.routes';
import webhookRoutes from './routes/webhook.routes';

import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';
import { CronService } from './services/CronService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  // Get IP (handles cases with/without proxies)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req.method, req.originalUrl, res.statusCode, duration, { ip });
  });

  next();
});

// Boot continuous automated verification
CronService.startBackgroundJobs();

// // Swagger definition
// const swaggerOptions = {
//   definition: {
//     openapi: '3.0.0',
//     info: {
//       title: 'Seat Reservation API',
//       version: '1.0.0',
//       description: 'API documentation using Swagger',
//     },
//     servers: [
//       {
//         url: `http://localhost:${PORT}/api`,
//       },
//     ],
//     components: {
//       securitySchemes: {
//         bearerAuth: {
//           type: 'http',
//           scheme: 'bearer',
//           bearerFormat: 'JWT',
//         },
//       },
//     },
//   },
//   // Support running from both src (ts) and dist (js)
//   apis: [
//     path.join(__dirname, './routes/*.ts'),
//     path.join(__dirname, './routes/*.js'),
//   ],
// };

// const swaggerDocs = swaggerJSDoc(swaggerOptions);
// app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});


// Security middleware
app.use(helmet());

const envOrigins = process.env.ALLOWED_ORIGINS;
const ALLOWED_ORIGINS = !envOrigins || envOrigins === '*' ? '*' : envOrigins.split(',');
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));
app.disable('x-powered-by');

app.use('/api/', limiter);
app.use((req, res, next) => {
  if (req.originalUrl === '/api/subscriptions/stripe/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: config.app.name,
    version: config.app.version
  });
});

// Health check
app.get('/health', appHealth);

// Routes
app.use('/api/bookings', bookingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoute);
app.use('/api/admin', authenticateAdmin, adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`
  });
});

// Global error handler
app.use(errorHandler);

// Function to start the server
const startServer = async (): Promise<void> => {
  try {
    // Optional: allow skipping DB for local docs preview
    if (process.env.SKIP_DB !== 'true') {
      await connectDB();
    } else {
      logger.warn('SKIP_DB is true: starting server without DB connection');
    }

    // Start the server only after successful database connection
    app.listen(PORT, () => {
      logger.info(`Server is running on port http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

export default app;