import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { adminRouter } from './modules/admin/admin.router.js';
import { authRouter } from './modules/auth/auth.router.js';
import { ordersRouter } from './modules/orders/orders.router.js';
import { productsRouter } from './modules/products/products.router.js';

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.use(helmet());
    app.use(cors({ origin: env.clientOrigin, credentials: true }));
    app.use(express.json({ limit: '1mb' }));
    const logger = pino();
    app.use((req, res, next) => {
        const started = Date.now();
        res.on('finish', () => {
            logger.info({ method: req.method, url: req.originalUrl, status: res.statusCode, ms: Date.now() - started });
        });
        next();
    });

    app.get('/api/health', (_req, res) => {
        res.json({ ok: true });
    });

    app.use('/api', productsRouter);
    app.use('/api', ordersRouter);
    app.use('/api', authRouter);
    app.use('/api', adminRouter);
    app.use(errorHandler);
    return app;
}
