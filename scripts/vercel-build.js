/**
 * Copies static assets into dist/ for Vercel (Output Directory = dist).
 * Output is deployed with Vercel cleanUrls: use links like /shop, /account (not *.html).
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const root = path.join(projectRoot, 'frontend');
const dist = path.join(projectRoot, 'dist');

const DIRS = ['css', 'js', 'img', 'fonts', 'images', 'blog'];
const ROOT_FILES = ['products.json', 'styles.css', 'admin-styles.css', 'favicon.svg'];

function rmrf(p) {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

rmrf(dist);
fs.mkdirSync(dist, { recursive: true });

for (const d of DIRS) {
    const src = path.join(root, d);
    if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(dist, d), { recursive: true });
    }
}

for (const f of ROOT_FILES) {
    const src = path.join(root, f);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(dist, f));
    }
}

for (const name of fs.readdirSync(root)) {
    if (name.endsWith('.html')) {
        fs.copyFileSync(path.join(root, name), path.join(dist, name));
    }
}

const migrateSrc = path.join(projectRoot, 'scripts', 'migrate-products.html');
if (fs.existsSync(migrateSrc)) {
    const sd = path.join(dist, 'scripts');
    fs.mkdirSync(sd, { recursive: true });
    fs.copyFileSync(migrateSrc, path.join(sd, 'migrate-products.html'));
}

console.log('vercel-build: output ->', dist);

// Post-process: concat+purge+minify CSS, minify JS, rewrite index.html.
const { execSync } = require('child_process');
execSync('node ' + JSON.stringify(path.join(__dirname, 'build-assets.js')), {
    stdio: 'inherit',
});
