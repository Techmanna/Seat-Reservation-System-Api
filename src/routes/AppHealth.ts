import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import config from '../config/environment';

// Define a simple model for health check (optional, for lightweight query)
const HealthCheckSchema = new mongoose.Schema({
    test: String
});
const HealthCheck = mongoose.model('HealthCheck', HealthCheckSchema, 'health_checks');

const router = Router();

// GET /health - Get application health status
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Application health check
 *     description: Returns service status, uptime, memory, and DB connectivity.
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 *       500:
 *         description: Health check failed
 */

router.get('/health', async (req, res: Response): Promise<void> => {
    try {
        // Check database connectivity with a lightweight query
        let dbStatus = 'unhealthy';
        let dbError: string | null = null;

        try {
            // Perform a lightweight query to check MongoDB connection
            await HealthCheck.findOne().limit(1).exec();
            dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
        } catch (error) {
            dbError = 'Failed to connect to MongoDB';
            dbStatus = 'unhealthy';
        }

        // Get server uptime
        const uptime = process.uptime(); // Seconds since process started
        const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

        // Get memory usage
        const memoryUsage = process.memoryUsage();
        const memoryFormatted = {
            heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
        };

        res.status(200).json({
            status: dbStatus === 'healthy' ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || config.app.version || '1.0.0',
            environment: config.nodeEnv || process.env.NODE_ENV || 'unknown',
            uptime: uptimeFormatted,
            memory: memoryFormatted,
            services: {
                database: {
                    status: dbStatus,
                    error: dbError
                }
            },
            app: {
                name: config.app.name || 'Seat Reservation Manager',
                port: config.port || 3000
            }
        });
    } catch (error) {
        logger.error('Health check failed', { error });
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
            message: 'An error occurred during the health check'
        });
    }
});

export default router;