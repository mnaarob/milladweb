import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const storefront = path.resolve(root, '../frontend');
const assetPrefixes = ['/images/', '/img/', '/fonts/'];
const storefrontPages = ['/privacy-policy.html', '/terms.html', '/blog.html', '/blog-details.html', '/blog-post.html', '/favicon.svg'];

function storeAssets(): Plugin {
    const types: Record<string, string> = {
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
    };
    const serve = (urlPath: string, res: import('node:http').ServerResponse, next: () => void) => {
        const allowed = assetPrefixes.some((prefix) => urlPath.startsWith(prefix)) || storefrontPages.includes(urlPath);
        if (!allowed) {
            next();
            return;
        }
        const file = path.normalize(path.join(storefront, urlPath));
        if (!file.startsWith(storefront) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            next();
            return;
        }
        const type = types[path.extname(file).toLowerCase()];
        if (type) res.setHeader('Content-Type', type);
        fs.createReadStream(file).pipe(res);
    };
    return {
        name: 'store-assets',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                serve(req.url?.split('?')[0] || '', res, next);
            });
        },
        configurePreviewServer(server) {
            server.middlewares.use((req, res, next) => {
                serve(req.url?.split('?')[0] || '', res, next);
            });
        },
        closeBundle() {
            const out = path.resolve(root, 'dist');
            for (const folder of ['images', 'img', 'fonts', 'blog']) {
                const from = path.join(storefront, folder);
                if (fs.existsSync(from)) fs.cpSync(from, path.join(out, folder), { recursive: true });
            }
            const favicon = path.join(storefront, 'favicon.svg');
            if (fs.existsSync(favicon)) fs.copyFileSync(favicon, path.join(out, 'favicon.svg'));
        },
    };
}

export default defineConfig({
    plugins: [react(), storeAssets()],
    envDir: path.resolve(root, '..'),
    server: {
        port: 5173,
        fs: { allow: [path.resolve(root, '..')] },
        proxy: {
            '/api': 'http://localhost:4000',
        },
    },
});
