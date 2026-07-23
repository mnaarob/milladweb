/**
 * Post-process the copied dist/ directory for production:
 *   1. Concatenate the seven homepage async stylesheets into a single
 *      home.min.css, then minify (csso) and PurgeCSS against the homepage HTML
 *      so unused selectors are dropped. Original css/ files are kept so the
 *      shop/account/blog pages can keep loading them individually.
 *   2. Minify the custom JS modules (main.js, app.js, modules/*, templates/*)
 *      via esbuild. Vendor minified files (jquery, owl, slicknav, bootstrap,
 *      nice-select) are left as-is — they're already minified.
 *   3. Rewrite index.html so the seven async preload tags collapse into one
 *      preload for home.min.css, and so script tags that point at the modules
 *      we just minified pick up the smaller files (no path change required —
 *      we overwrite in place).
 *
 * Runs only against dist/. The repo's css/ and js/ folders are never touched.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const csso = require('csso');
const { PurgeCSS } = require('purgecss');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const HOMEPAGE_CSS = [
    'css/style.css',
    'css/theme.css',
    'css/components.css',
    'css/animations.css',
    'css/vendor/nice-select.css',
    'css/vendor/owl.carousel.min.css',
    'css/vendor/slicknav.min.css',
];

const JS_TO_MINIFY = [
    'js/vendor/main.js',
    'js/app.js',
    'js/shop-app.js',
    'js/account-app.js',
    'js/admin-app.js',
    'js/config/supabase.js',
    'js/services/auth.js',
    'js/services/database.js',
    'js/services/stripe.js',
    'js/modules/animations.js',
    'js/modules/auth-ui.js',
    'js/modules/auth-validation.js',
    'js/modules/cart.js',
    'js/modules/cart-ui.js',
    'js/modules/catalog-sync.js',
    'js/modules/checkout.js',
    'js/modules/product-modal.js',
    'js/modules/products.js',
    'js/modules/scroll-lock.js',
    'js/modules/search.js',
    'js/templates/html.js',
];

async function buildHomeCss() {
    const concat = HOMEPAGE_CSS
        .map((rel) => {
            const p = path.join(dist, rel);
            return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
        })
        .join('\n');

    const purged = await new PurgeCSS().purge({
        // Also scan our JS modules so any classes JS adds at runtime
        // (page-visible, reveal--visible, show, active, etc.) survive.
        content: [
            { raw: fs.readFileSync(path.join(dist, 'index.html'), 'utf8'), extension: 'html' },
            ...['js/vendor/main.js', 'js/app.js']
                .concat(fs.readdirSync(path.join(dist, 'js/modules')).map((f) => 'js/modules/' + f))
                .concat(fs.readdirSync(path.join(dist, 'js/templates')).map((f) => 'js/templates/' + f))
                .map((rel) => ({
                    raw: fs.readFileSync(path.join(dist, rel), 'utf8'),
                    extension: 'js',
                })),
        ],
        css: [{ raw: concat }],
        // Default extractor is bad at finding class names inside JS string
        // literals (it's tuned for HTML). Use a permissive extractor that
        // grabs anything that looks like a token.
        defaultExtractor: (content) => content.match(/[A-Za-z0-9_-]+/g) || [],
        safelist: {
            standard: [
                'show', 'active', 'open', 'loaded', 'loading', 'loader',
                'preloder', 'bump', 'over_hid', 'page-visible', 'page-exit',
                'reveal', 'reveal--visible', 'img-blur-up',
                'img-scale-in', 'img-scale-in--visible',
                'show__humberger__menu__wrapper',
                'checkout-modal--open',
                'header__cart__badge--bump',
                'featured__item__pic__hover', 'product__item__pic__hover',
            ],
            deep: [
                /^owl-/, /^slicknav/, /^nice-select/, /^page-/,
                /^cart-/, /^checkout-/, /^product-modal/,
                /^humberger/, /^header__/, /^reveal/,
            ],
            greedy: [/^icon-/, /^js-/, /^col-/, /^row$/, /^container/, /^offset-/, /^d-/, /^justify-/, /^align-/],
        },
    });

    const purgedCss = purged.map((p) => p.css).join('\n');
    const minified = csso.minify(purgedCss).css;
    const outPath = path.join(dist, 'css', 'home.min.css');
    fs.writeFileSync(outPath, minified);

    console.log('build-assets: home.min.css ->', minified.length, 'bytes');
}

async function rewriteIndexHtml() {
    const indexPath = path.join(dist, 'index.html');
    if (!fs.existsSync(indexPath)) return;
    let html = fs.readFileSync(indexPath, 'utf8');

    const preloadBlockRegex = /<link rel="preload" href="css\/style\.css"[\s\S]*?<link rel="preload" href="css\/vendor\/slicknav\.min\.css"[^>]*>/;
    const noscriptBlockRegex = /<link rel="stylesheet" href="css\/style\.css">[\s\S]*?<link rel="stylesheet" href="css\/vendor\/slicknav\.min\.css">/;

    html = html.replace(
        preloadBlockRegex,
        '<link rel="preload" href="css/home.min.css" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">'
    );
    html = html.replace(
        noscriptBlockRegex,
        '<link rel="stylesheet" href="css/home.min.css">'
    );

    fs.writeFileSync(indexPath, html);
    console.log('build-assets: index.html rewritten to use home.min.css');
}

function stripHtmlComments() {
    const htmlFiles = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith('.html')) {
                htmlFiles.push(full);
            }
        }
    };
    walk(dist);

    // Remove standard HTML comments while preserving IE conditional comments
    // (<!--[if ...]> ... <![endif]-->) which carry meaning to old browsers.
    const commentRegex = /<!--(?!\[if)[\s\S]*?-->/g;

    let cleaned = 0;
    for (const file of htmlFiles) {
        const before = fs.readFileSync(file, 'utf8');
        const after = before.replace(commentRegex, '');
        if (after !== before) {
            fs.writeFileSync(file, after);
            cleaned++;
        }
    }
    console.log('build-assets: stripped HTML comments from', cleaned, 'file(s)');
}

async function minifyJs() {
    const targets = JS_TO_MINIFY
        .map((rel) => path.join(dist, rel))
        .filter((p) => fs.existsSync(p));

    if (!targets.length) return;

    await Promise.all(targets.map(async (file) => {
        const before = fs.statSync(file).size;
        const result = await esbuild.transform(fs.readFileSync(file, 'utf8'), {
            minify: true,
            target: 'es2019',
            legalComments: 'none',
            // Strip all console.* calls and debugger statements so nothing
            // leaks into the browser console in production.
            drop: ['console', 'debugger'],
            loader: file.endsWith('.mjs') ? 'js' : 'js',
        });
        fs.writeFileSync(file, result.code);
        const after = result.code.length;
        const pct = before ? Math.round(100 * (before - after) / before) : 0;
        console.log(`build-assets: ${path.relative(dist, file)}  ${before} -> ${after} bytes (-${pct}%)`);
    }));
}

(async () => {
    if (!fs.existsSync(dist)) {
        throw new Error('build-assets: dist/ not found — run vercel-build.js first.');
    }
    await buildHomeCss();
    await rewriteIndexHtml();
    await minifyJs();
    stripHtmlComments();
    console.log('build-assets: done.');
})().catch((err) => {
    console.error('build-assets failed:', err);
    process.exit(1);
});
