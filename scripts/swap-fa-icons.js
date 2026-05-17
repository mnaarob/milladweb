#!/usr/bin/env node
/**
 * Replace every <i class="fa fa-XXX"...></i> in the live customer-facing HTML
 * with <svg class="icon icon-XXX"...><use href="/img/icons.svg#icon-XXX"></use></svg>.
 *
 * Only icons present in img/icons.svg are touched. Unknown icons are left as-is
 * and printed to stderr so we can extend the sprite.
 *
 *   node scripts/swap-fa-icons.js [--check] [--files=index.html,shop.html,...]
 *
 * Default file set: index.html, shop.html, account.html, blog/*.html
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SPRITE_FILE = path.join(ROOT, 'img', 'icons.svg');

function spriteIconIds() {
    const src = fs.readFileSync(SPRITE_FILE, 'utf8');
    const ids = new Set();
    const re = /id="icon-([a-z0-9-]+)"/g;
    let m;
    while ((m = re.exec(src))) ids.add(m[1]);
    return ids;
}

const KNOWN = spriteIconIds();

function listDefaultFiles() {
    const blogDir = path.join(ROOT, 'blog');
    const blogFiles = fs.existsSync(blogDir)
        ? fs.readdirSync(blogDir).filter(f => f.endsWith('.html')).map(f => path.join('blog', f))
        : [];
    return ['index.html', 'shop.html', 'account.html', ...blogFiles];
}

function buildSvg(icon, extraAttrs) {
    // extraAttrs is everything from the original <i> minus class= and the
    // fa/fa-XXX tokens, preserved verbatim so things like onerror="..." or
    // role attributes stay intact.
    const attrs = extraAttrs.trim().length ? ' ' + extraAttrs.trim() : '';
    return `<svg class="icon icon-${icon}" aria-hidden="true"${attrs}><use href="/img/icons.svg#icon-${icon}"></use></svg>`;
}

function transform(html, file) {
    let unknown = new Set();
    let count = 0;

    // Match <i ...class="...fa fa-XXX..."...></i>.
    // We use a non-greedy attribute scan and only allow a single fa-XXX class.
    const tagRe = /<i\b([^>]*?)class="([^"]*)"([^>]*)><\/i>/g;
    const out = html.replace(tagRe, (full, pre, cls, post) => {
        const classes = cls.split(/\s+/).filter(Boolean);
        if (!classes.includes('fa') && !classes.some(c => c.startsWith('fas'))) return full;
        const iconClass = classes.find(c => /^fa-[a-z0-9-]+$/.test(c));
        if (!iconClass) return full;
        const icon = iconClass.slice(3);
        if (!KNOWN.has(icon)) {
            unknown.add(icon);
            return full;
        }
        // Re-build any non-fa classes (rare but possible) onto the <svg> tag.
        const otherClasses = classes.filter(c => c !== 'fa' && c !== iconClass && c !== 'fas');
        const svgClass = ['icon', `icon-${icon}`, ...otherClasses].join(' ');
        const attrsBefore = pre.replace(/\s+aria-hidden="(true|false)"/g, '').trim();
        const attrsAfter = post.replace(/\s+aria-hidden="(true|false)"/g, '').trim();
        const extra = [attrsBefore, attrsAfter].filter(Boolean).join(' ');
        const extraTail = extra ? ' ' + extra : '';
        count++;
        return `<svg class="${svgClass}" aria-hidden="true"${extraTail}><use href="/img/icons.svg#icon-${icon}"></use></svg>`;
    });

    return { out, count, unknown };
}

const args = process.argv.slice(2);
const isCheck = args.includes('--check');
const filesArg = args.find(a => a.startsWith('--files='));
const files = filesArg
    ? filesArg.slice('--files='.length).split(',')
    : listDefaultFiles();

let totalSwapped = 0;
const allUnknown = new Set();

for (const rel of files) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
        console.warn('SKIP (missing):', rel);
        continue;
    }
    const html = fs.readFileSync(full, 'utf8');
    const { out, count, unknown } = transform(html, rel);
    unknown.forEach(u => allUnknown.add(u));
    if (count === 0) {
        console.log(`${rel}: no changes`);
        continue;
    }
    if (!isCheck) fs.writeFileSync(full, out);
    console.log(`${rel}: ${isCheck ? 'would replace' : 'replaced'} ${count} icons`);
    totalSwapped += count;
}

if (allUnknown.size) {
    console.warn('\nUnknown icons (left in place, add to img/icons.svg):');
    for (const u of allUnknown) console.warn('  fa-' + u);
}

console.log(`\nTotal: ${totalSwapped} icon swaps across ${files.length} files`);
if (allUnknown.size) process.exitCode = 2;
