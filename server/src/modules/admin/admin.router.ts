import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { requireUser } from '../../middleware/authenticate.js';
import { HttpError } from '../../lib/http.js';
import { hasServiceRole } from '../../lib/supabase.js';
import { requireStaff } from '../../middleware/requireStaff.js';
import {
    createProduct,
    inviteStaff,
    listAdminProducts,
    listOrders,
    parseProduct,
    removeProduct,
    setOrderStatus,
    setOrderTotal,
    setOrderWeights,
    updateProduct,
} from './admin.service.js';

export const adminRouter = Router();

adminRouter.use(requireUser, (req, _res, next) => {
    if (!hasServiceRole) {
        next(new HttpError(503, 'Add SUPABASE_SERVICE_ROLE_KEY before using admin.'));
        return;
    }
    requireStaff(req, _res, next);
});

adminRouter.get('/admin/products', asyncHandler(async (_req, res) => {
    res.json(await listAdminProducts());
}));

adminRouter.post('/admin/products', asyncHandler(async (req, res) => {
    res.status(201).json(await createProduct(parseProduct(req.body)));
}));

adminRouter.put('/admin/products/:id', asyncHandler(async (req, res) => {
    await updateProduct(req.params.id, parseProduct(req.body));
    res.json({ ok: true });
}));

adminRouter.delete('/admin/products/:id', asyncHandler(async (req, res) => {
    await removeProduct(req.params.id);
    res.json({ ok: true });
}));

adminRouter.get('/admin/orders', asyncHandler(async (_req, res) => {
    res.json(await listOrders());
}));

adminRouter.patch('/admin/orders/:id/status', asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    await setOrderStatus(req.params.id, status);
    res.json({ ok: true });
}));

adminRouter.patch('/admin/orders/:id/weights', asyncHandler(async (req, res) => {
    const { quantities } = z.object({
        quantities: z.array(z.object({
            index: z.number().int().nonnegative(),
            quantity: z.number().positive().max(99.999),
            cancelled: z.boolean().optional(),
        })).min(1),
    }).parse(req.body);
    res.json(await setOrderWeights(req.params.id, quantities));
}));

adminRouter.patch('/admin/orders/:id/total', asyncHandler(async (req, res) => {
    const { total, note } = z.object({
        total: z.number().nonnegative().nullable(),
        note: z.string().max(200).optional(),
    }).parse(req.body);
    res.json(await setOrderTotal(req.params.id, total, note));
}));

adminRouter.post('/admin/invites', asyncHandler(async (req, res) => {
    const body = z.object({
        email: z.string().trim().email(),
        role: z.enum(['owner', 'manager', 'staff']).default('staff'),
    }).parse(req.body);
    await inviteStaff(body.email, body.role);
    res.json({ ok: true });
}));
