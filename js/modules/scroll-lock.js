'use strict';

/**
 * Shared, refcounted body scroll lock.
 *
 * Why position:fixed instead of just `overflow:hidden`?
 * - On iOS Safari, `overflow:hidden` on <body> does NOT prevent touch scrolling.
 * - `position:fixed; top:-y; width:100%` actually freezes the page; we restore
 *   the scroll position on unlock.
 *
 * Refcount lets multiple overlapping modals (e.g. cart -> checkout) coexist
 * without prematurely restoring scroll between transitions.
 */

let lockCount = 0;
let savedY = 0;

export function lockBodyScroll() {
    if (lockCount === 0) {
        savedY = window.scrollY || window.pageYOffset || 0;
        const body = document.body;
        const html = document.documentElement;
        body.style.overflow = 'hidden';
        html.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.top = `-${savedY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
    }
    lockCount += 1;
}

export function unlockBodyScroll() {
    if (lockCount === 0) return;
    lockCount -= 1;
    if (lockCount === 0) {
        const body = document.body;
        const html = document.documentElement;
        body.style.overflow = '';
        html.style.overflow = '';
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        window.scrollTo(0, savedY);
    }
}

/** Force-release any outstanding locks (use sparingly, e.g. on hard navigation). */
export function resetBodyScrollLock() {
    if (lockCount === 0) return;
    lockCount = 0;
    const body = document.body;
    const html = document.documentElement;
    body.style.overflow = '';
    html.style.overflow = '';
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    window.scrollTo(0, savedY);
}

if (typeof window !== 'undefined') {
    window.__milladScrollLock = {
        lock: lockBodyScroll,
        unlock: unlockBodyScroll,
        reset: resetBodyScrollLock,
    };
}
