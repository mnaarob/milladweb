import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof ZodError) {
        res.status(400).json({ error: err.issues[0]?.message || 'Invalid request' });
        return;
    }
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
    }
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error(message);
    res.status(500).json({ error: 'Unexpected error' });
}
