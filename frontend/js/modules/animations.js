'use strict';

import { lockBodyScroll, unlockBodyScroll } from './scroll-lock.js';

let revealObserver = null;
let scaleObserver = null;

function applyReveal(el, delay) {
    if (el.classList.contains('reveal')) return;
    el.classList.add('reveal');
    if (delay != null) el.style.transitionDelay = delay + 's';
    if (revealObserver) {
        revealObserver.observe(el);
    } else {
        el.classList.add('reveal--visible');
    }
}

function applyImgScale(el) {
    if (!el || el.dataset.imgScaleApplied === '1') return;
    el.dataset.imgScaleApplied = '1';
    el.classList.add('img-scale-in');
    if (scaleObserver) {
        scaleObserver.observe(el);
    } else {
        triggerImgScale(el);
    }
}

function triggerImgScale(el) {
    el.classList.add('img-scale-in--visible');
    var cleanup = function () {
        el.classList.remove('img-scale-in', 'img-scale-in--visible');
        el.removeEventListener('animationend', cleanup);
    };
    el.addEventListener('animationend', cleanup);
    setTimeout(cleanup, 600);
}

function initRevealObserver() {
    if (!('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal--visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

    scaleObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                triggerImgScale(entry.target);
                scaleObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -20px 0px' });
}

function revealStaticElements() {
    document.querySelectorAll('.section-title').forEach(function (el, i) {
        applyReveal(el, i * 0.04);
    });

    document.querySelectorAll('.categories__item').forEach(function (el, i) {
        if (el.closest('.owl-carousel')) return;
        applyReveal(el, i * 0.06);
    });

    document.querySelectorAll('.banner__item').forEach(function (el, i) {
        applyReveal(el, i * 0.08);
    });

    document.querySelectorAll('.footer__widget').forEach(function (el, i) {
        applyReveal(el, i * 0.06);
    });

    var featured = document.querySelectorAll('.featured__item');
    var fParents = new Map();
    featured.forEach(function (el) {
        var p = el.parentElement;
        if (!fParents.has(p)) fParents.set(p, 0);
        var idx = fParents.get(p);
        applyReveal(el, idx * 0.06);
        fParents.set(p, idx + 1);
    });

    document.querySelectorAll('.featured__item__pic, .product__item__pic').forEach(applyImgScale);
}

function watchDynamicGrid(gridId) {
    var grid = document.getElementById(gridId);
    if (!grid || !('MutationObserver' in window)) return;
    var mo = new MutationObserver(function () {
        var cols = grid.querySelectorAll('.col-lg-4, .col-lg-3, .col-md-6, .col-md-4');
        cols.forEach(function (col, i) {
            var card = col.querySelector('.product__item, .featured__item');
            if (card) {
                applyReveal(card, (i % 12) * 0.05);
            }
        });
        grid.querySelectorAll('.featured__item__pic, .product__item__pic').forEach(applyImgScale);
    });
    mo.observe(grid, { childList: true });
}

export function initBlurUpImages() {
    document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
        if (img.complete && img.naturalWidth > 0) {
            img.classList.add('loaded');
            return;
        }
        img.classList.add('img-blur-up');
        img.addEventListener('load', function () {
            img.classList.add('loaded');
        }, { once: true });
    });
}

var preloaded = new Set();

function eventElement(target) {
    if (!target) return null;
    if (target.nodeType === 1) return target;
    return target.parentElement || null;
}

function closestAnchor(target) {
    var el = eventElement(target);
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest('a[href]');
}

function initPrefetchOnHover() {
    document.addEventListener('pointerenter', function (e) {
        var link = closestAnchor(e.target);
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href || href.startsWith('#') || preloaded.has(href)) return;
        try {
            var url = new URL(href, location.href);
            if (url.origin !== location.origin) return;
        } catch (err) { return; }
        preloaded.add(href);
        var hint = document.createElement('link');
        hint.rel = 'prefetch';
        hint.href = href;
        document.head.appendChild(hint);
    }, true);
}

function isInternalPageNavigation(href) {
    if (/\.html($|[?#])/.test(href)) return true;
    if (/^\/([?#]|$)/.test(href)) return true;
    if (/^\/(shop|account|admin)([?#/]|$)/.test(href)) return true;
    return false;
}

var hasNativeViewTransitions = typeof document.startViewTransition === 'function'
    || document.querySelector('meta[name="view-transition"]') !== null;

export function initAnimations() {
    document.body.classList.add('page-visible');

    if (!hasNativeViewTransitions) {
        document.addEventListener('click', function (e) {
            var link = closestAnchor(e.target);
            if (!link) return;
            var href = link.getAttribute('href');
            if (!href || href === '#' || href.charAt(0) === '#') return;
            if (href.startsWith('javascript') || href.startsWith('mailto') || href.startsWith('tel')) return;
            if (!isInternalPageNavigation(href)) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (link.target === '_blank') return;
            if (link.getAttribute('onclick')) return;
            e.preventDefault();
            document.body.classList.add('page-exit');
            setTimeout(function () { window.location.href = href; }, 220);
        });
    }

    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto';
    }

    initRevealObserver();
    revealStaticElements();
    initPrefetchOnHover();

    watchDynamicGrid('featuredGrid');
    watchDynamicGrid('productsGrid');
}

export function openCartModal() {
    var modal = document.getElementById('cartModal');
    if (!modal) return;
    if (modal.dataset.scrollLocked === '1') return;
    lockBodyScroll();
    modal.dataset.scrollLocked = '1';
    modal.style.display = 'flex';
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { modal.classList.add('open'); });
    });
}

export function closeCartModal() {
    var modal = document.getElementById('cartModal');
    if (!modal) return;
    modal.classList.remove('open');
    if (modal.dataset.scrollLocked === '1') {
        delete modal.dataset.scrollLocked;
        unlockBodyScroll();
    }
    var handler = function () {
        if (modal.classList.contains('open')) return;
        modal.style.display = 'none';
        modal.removeEventListener('transitionend', handler);
    };
    modal.addEventListener('transitionend', handler);
    setTimeout(function () {
        if (!modal.classList.contains('open')) modal.style.display = 'none';
    }, 350);
}
