import { createApp } from '../server/dist/app.js';

const app = createApp();

export default function handler(req, res) {
    const raw = req.url || '/';
    const qIndex = raw.indexOf('?');
    const search = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
    const params = new URLSearchParams(search);
    const routed = params.get('path');
    if (routed) {
        params.delete('path');
        const rest = params.toString();
        req.url = `/api/${routed}${rest ? `?${rest}` : ''}`;
    }
    return app(req, res);
}
