'use strict';

let revealObserver = null;

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
}

function watchDynamicGrid(gridId) {
    var grid = document.getElementById(gridId);
    if (!grid || !('MutationObserver' in window)) return;
    var mo = new MutationObserver(function () {
        var cols = grid.querySelectorAll('.col-lg-4, .col-lg-3, .col-md-6, .col-md-4');
        cols.forEach(function (col, i) {
            var card = col.querySelector('.product__item, .featured__item');
            if (card) {
                if (gridId === 'productsGrid') {
                    card.classList.add('reveal', 'reveal--visible');
                } else {
                    applyReveal(card, (i % 12) * 0.05);
                }
            }
        });
    });
    mo.observe(grid, { childList: true });
}

function isInternalPageNavigation(href) {
    if (/\.html($|[?#])/.test(href)) return true;
    if (/^\/([?#]|$)/.test(href)) return true;
    if (/^\/(shop|account|admin)([?#/]|$)/.test(href)) return true;
    return false;
}

export function initAnimations() {
    document.body.classList.add('page-visible');

    document.addEventListener('click', function (e) {
        var link = e.target.closest('a[href]');
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

    initRevealObserver();
    revealStaticElements();

    watchDynamicGrid('featuredGrid');
    watchDynamicGrid('productsGrid');
}

export function openCartModal() {
    var modal = document.getElementById('cartModal');
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { modal.classList.add('open'); });
    });
}

export function closeCartModal() {
    var modal = document.getElementById('cartModal');
    if (!modal) return;
    modal.classList.remove('open');
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
