import { onAuthChange, signOut, isAdmin } from '../services/auth.js';

function setAuthLinks(user, admin) {
    const accountBtns = [
        document.getElementById('headerAccountBtn'),
        document.getElementById('mobileAccountBtn')
    ];
    const signOutBtns = [
        document.getElementById('headerSignOutBtn'),
        document.getElementById('mobileSignOutBtn')
    ];
    const mobileLabel = document.querySelector('#mobileAccountBtn .auth-label');

    if (!user) {
        accountBtns.forEach(el => { if (el) el.href = '/account'; });
        signOutBtns.forEach(el => { if (el) el.style.display = 'none'; });
        if (mobileLabel) mobileLabel.textContent = 'Account';
        return;
    }

    if (admin) {
        accountBtns.forEach(el => { if (el) el.href = '/account'; });
        signOutBtns.forEach(el => { if (el) el.style.display = ''; });
        if (mobileLabel) mobileLabel.textContent = 'Account';
        return;
    }

    accountBtns.forEach(el => { if (el) el.href = '/account'; });
    signOutBtns.forEach(el => { if (el) el.style.display = ''; });
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Account';
    if (mobileLabel) mobileLabel.textContent = displayName;
}

export function initAuthUI() {
    onAuthChange(async (user) => {
        const admin = user ? await isAdmin(user) : false;
        setAuthLinks(user, admin);
    });

    document.addEventListener('click', (e) => {
        const signOutLink = e.target.closest('#headerSignOutBtn, #mobileSignOutBtn');
        if (signOutLink) {
            e.preventDefault();
            signOut().catch(() => {});
        }
    });
}
