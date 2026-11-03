import { createApp } from '../server/dist/app.js';

const app = createApp();

export default function handler(req, res) {
    const raw = req.url || '/';
    const pathOnly = raw.split('?')[0];
    if (!pathOnly.startsWith('/api')) {
        const parts = Array.isArray(req.query?.all) ? req.query.all : [];
        const qs = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
        req.url = `/api${parts.length ? `/${parts.join('/')}` : ''}${qs}`;
    }
    return app(req, res);
}
