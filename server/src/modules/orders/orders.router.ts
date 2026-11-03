import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/http.js';
import { optionalUser, requireUser, type AuthedRequest } from '../../middleware/authenticate.js';
import { listMyOrders, parseOrder, placeOrder } from './orders.service.js';

const orderLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    message: { error: 'Too many orders — please try again later' },
});

export const ordersRouter = Router();

ordersRouter.post(
    '/orders',
    orderLimit,
    optionalUser,
    asyncHandler(async (req, res) => {
        const input = parseOrder(req.body);
        const userId = (req as AuthedRequest).user?.id ?? null;
        res.status(201).json(await placeOrder(input, userId));
    }),
);

ordersRouter.get(
    '/account/orders',
    requireUser,
    asyncHandler(async (req, res) => {
        res.json(await listMyOrders((req as AuthedRequest).user.id));
    }),
);
