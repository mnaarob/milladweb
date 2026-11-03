import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { listCategories, listFeatured, listProducts } from './products.service.js';

export const productsRouter = Router();

productsRouter.get(
    '/products',
    asyncHandler(async (req, res) => {
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        res.json(await listProducts(category));
    }),
);

productsRouter.get(
    '/products/featured',
    asyncHandler(async (_req, res) => {
        res.json(await listFeatured());
    }),
);

productsRouter.get(
    '/categories',
    asyncHandler(async (_req, res) => {
        res.json(await listCategories());
    }),
);
