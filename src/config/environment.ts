import dotenv from 'dotenv';

dotenv.config();

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),

    app: {
        name: process.env.APP_NAME || 'Dev Meter',
        version: process.env.npm_package_version || '1.0.0',
        frontendUrl: process.env.FRONTEND_URL!,
    },

    // Mail Configuration
    mail: {
        host: process.env.MAIL_HOST || 'mail.themorayobrownshow.com',
        port: parseInt(process.env.MAIL_PORT || '465', 10),
        secure: process.env.MAIL_SECURE === 'true',
        senderEmail: process.env.MAIL_SENDER_EMAIL || 'hello@themorayobrownshow.com',
        password: process.env.MAIL_PASSWORD || 'g!)(wE18yu-j',
        from: process.env.MAIL_FROM || 'The Morayo Brown Show <hello@themorayobrownshow.com>',
    },

    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    // Database Configaration
    db: {
        mongodb: process.env.MONGODB_URI!
    },

    // SMS
    africastalking: {
        piKey: process.env.AFRICASTALKING_API_KEY!,
        username: process.env.AFRICASTALKING_USERNAME!
    },
    
    // Frontend URL
    url: process.env.FRONTEND_URL!,
    adminUrl: process.env.ADMIN_URL || 'https://admin.themorayobrownshow.com'
};

// Validate required environment variables
const requiredEnvVars: string[] | undefined = [
    'MONGODB_URI',
    'FRONTEND_URL',
    'MAIL_HOST',
    'MAIL_PORT',
    'MAIL_SECURE',
    'MAIL_SENDER_EMAIL',
    'MAIL_PASSWORD',
    'MAIL_FROM'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export default config;