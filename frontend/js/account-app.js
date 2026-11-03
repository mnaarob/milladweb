import { signIn, requestSignupCode, verifySignupCode, onAuthChange, updateUserMetadata, getCurrentUser, resetPasswordForEmail, updateUserPassword } from './services/auth.js';
import { getOrdersByUser } from './services/database.js?v=4';
import { initCart } from './modules/cart-ui.js';
import { initCheckout } from './modules/checkout.js?v=5';
import { initAuthUI } from './modules/auth-ui.js';
import { initAnimations } from './modules/animations.js';
import { getTurnstileSiteKey } from './config/supabase.js';
import {
    isValidEmail,
    isDisposableEmail,
    getPasswordErrors,
    checkHoneypot,
    checkPasswordResetRateLimit
} from './modules/auth-validation.js';

const PW_REC_STORAGE_KEY = 'millads_pw_rec';

let inPasswordRecovery = false;

let signInWidgetId = null;
let signUpWidgetId = null;

function turnstileOpts() {
    const sitekey = getTurnstileSiteKey();
    return {
        sitekey,
        theme: 'light',
        size: 'normal',
        'error-callback': function () {
            console.warn('Turnstile error — check site key and domain allowlist in Cloudflare Turnstile.');
        }
    };
}

/** Turnstile iframes often fail when the host is display:none. Render only the widget for the visible auth tab. */
function ensureTurnstileForTab(tab) {
    if (typeof turnstile === 'undefined') {
        setTimeout(function () {
            ensureTurnstileForTab(tab);
        }, 150);
        return;
    }
    if (tab === 'signin') {
        if (signInWidgetId !== null) return;
        if (!document.getElementById('signInCaptcha')) return;
        signInWidgetId = turnstile.render('#signInCaptcha', turnstileOpts());
    } else if (tab === 'signup') {
        if (signUpWidgetId !== null) return;
        if (!document.getElementById('signUpCaptcha')) return;
        signUpWidgetId = turnstile.render('#signUpCaptcha', turnstileOpts());
    }
}

function initTurnstile() {
    const active = document.querySelector('.account-tabs li.active')?.dataset?.tab || 'signin';
    ensureTurnstileForTab(active);
}

function getCaptchaToken(widgetId) {
    if (typeof turnstile === 'undefined' || widgetId === null) return '';
    return turnstile.getResponse(widgetId) || '';
}

function resetCaptcha(widgetId) {
    if (typeof turnstile !== 'undefined' && widgetId !== null) {
        turnstile.reset(widgetId);
    }
}

function hashHasRecoveryType() {
    return (window.location.hash || '').includes('type=recovery');
}

function showPasswordRecoveryUI() {
    document.getElementById('accountLoggedOut').style.display = 'block';
    document.getElementById('accountLoggedIn').style.display = 'none';
    const tabs = document.querySelector('.account-tabs');
    if (tabs) tabs.style.display = 'none';
    const signin = document.getElementById('signinForm');
    const signup = document.getElementById('signupForm');
    const forgot = document.getElementById('forgotPasswordPanel');
    const recovery = document.getElementById('passwordRecoveryPanel');
    if (signin) signin.style.display = 'none';
    if (signup) signup.style.display = 'none';
    if (forgot) forgot.style.display = 'none';
    if (recovery) recovery.style.display = 'block';
    const recErr = document.getElementById('passwordRecoveryError');
    if (recErr) recErr.textContent = '';
}

function showForgotPasswordPanel() {
    const signin = document.getElementById('signinForm');
    const forgot = document.getElementById('forgotPasswordPanel');
    const signup = document.getElementById('signupForm');
    const tabs = document.querySelector('.account-tabs');
    if (tabs) tabs.style.display = 'none';
    if (signin) signin.style.display = 'none';
    if (signup) signup.style.display = 'none';
    if (forgot) {
        forgot.style.display = 'block';
        const success = document.getElementById('forgotPasswordSuccess');
        const form = document.getElementById('forgotPasswordForm');
        const err = document.getElementById('forgotPasswordError');
        if (success) success.style.display = 'none';
        if (form) form.style.display = '';
        if (err) err.textContent = '';
    }
}

function showLoggedOut() {
    inPasswordRecovery = false;
    try {
        sessionStorage.removeItem(PW_REC_STORAGE_KEY);
    } catch (_) { /* ignore */ }

    document.getElementById('accountLoggedOut').style.display = 'block';
    document.getElementById('accountLoggedIn').style.display = 'none';

    const tabs = document.querySelector('.account-tabs');
    if (tabs) tabs.style.display = '';
    const recovery = document.getElementById('passwordRecoveryPanel');
    const forgot = document.getElementById('forgotPasswordPanel');
    const signin = document.getElementById('signinForm');
    const signup = document.getElementById('signupForm');
    if (recovery) recovery.style.display = 'none';
    if (forgot) {
        forgot.style.display = 'none';
        const success = document.getElementById('forgotPasswordSuccess');
        const form = document.getElementById('forgotPasswordForm');
        if (success) success.style.display = 'none';
        if (form) form.style.display = '';
        const fe = document.getElementById('forgotPasswordError');
        if (fe) fe.textContent = '';
    }
    if (signup) signup.style.display = 'none';
    if (signin) signin.style.display = 'block';
    showTab('signin');
}

function showLoggedIn(user) {
    document.getElementById('accountLoggedOut').style.display = 'none';
    document.getElementById('accountLoggedIn').style.display = 'block';

    const meta = user.user_metadata || {};
    const fullName = meta.full_name || '';
    const email = user.email || '';

    document.getElementById('profileName').value = fullName;
    document.getElementById('profilePhone').value = meta.phone || '';
    document.getElementById('profileEmail').value = email;

    const avatar = document.getElementById('acctAvatar');
    const welcomeName = document.getElementById('acctWelcomeName');
    const welcomeEmail = document.getElementById('acctWelcomeEmail');

    if (avatar) {
        const initials = fullName
            ? fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
            : email[0]?.toUpperCase() || 'U';
        avatar.textContent = initials;
    }
    if (welcomeName) welcomeName.textContent = fullName ? `Welcome, ${fullName}` : 'Welcome back';
    if (welcomeEmail) welcomeEmail.textContent = email;

    loadOrderHistory();
}

async function loadOrderHistory() {
    const container = document.getElementById('orderHistoryList');
    try {
        const orders = await getOrdersByUser();
        if (orders.length === 0) {
            container.innerHTML = '<p class="account-empty">No orders yet. <a href="/shop">Start shopping</a></p>';
            return;
        }
        container.innerHTML = orders.map(order => {
            const shortId = order.id.slice(-6).toUpperCase();
            const date = order.timestamp.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const total = order.pricing?.total ?? 0;
            const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
            const itemsHtml = (order.items || []).map(i => `<p><span>${escapeHtml(i.name)} x ${escapeHtml(String(i.quantity || 0))}</span> <span>$${(Number(i.price) * (i.quantity || 0)).toFixed(2)}</span></p>`).join('');
            return `
                <div class="order-history-item">
                    <div class="order-history-header">
                        <span class="order-id">#${shortId}</span>
                        <span class="order-date">${date}</span>
                        <span class="order-status order-status-${(order.status || '').replace(/[^a-z0-9_-]/gi, '')}">${escapeHtml(String(order.status || ''))}</span>
                        <span class="order-total">$${Number(total).toFixed(2)}</span>
                    </div>
                    <div class="order-history-details">
                        <p class="order-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</p>
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error loading orders:', err);
        container.innerHTML = '<p class="account-error">Failed to load orders.</p>';
    }
}

function showTab(tab) {
    if (inPasswordRecovery) return;
    const forgotPanel = document.getElementById('forgotPasswordPanel');
    if (forgotPanel) forgotPanel.style.display = 'none';
    document.querySelectorAll('.account-tabs li').forEach(l => {
        l.classList.toggle('active', l.dataset.tab === tab);
    });
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    if (signinForm) signinForm.style.display = tab === 'signin' ? 'block' : 'none';
    if (signupForm) signupForm.style.display = tab === 'signup' ? 'block' : 'none';
    const signInErr = document.getElementById('signInError');
    const signUpErr = document.getElementById('signUpError');
    if (signInErr) signInErr.textContent = '';
    if (signUpErr) signUpErr.textContent = '';

    requestAnimationFrame(function () {
        ensureTurnstileForTab(tab);
    });
}

function setupTabs() {
    if (window.location.hash === '#signup') {
        showTab('signup');
    }
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#signup') showTab('signup');
        else showTab('signin');
    });
    document.querySelectorAll('.account-tabs li').forEach(li => {
        li.addEventListener('click', () => {
            showTab(li.dataset.tab);
            window.location.hash = li.dataset.tab === 'signup' ? '#signup' : '';
        });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function setupForms() {
    document.getElementById('signInForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signInEmail').value.trim();
        const password = document.getElementById('signInPassword').value;
        const errEl = document.getElementById('signInError');
        const btn = document.getElementById('signInBtn');
        errEl.textContent = '';
        if (!isValidEmail(email)) {
            errEl.textContent = 'Please enter a valid email address.';
            return;
        }
        const captchaToken = getCaptchaToken(signInWidgetId);
        if (!captchaToken) {
            errEl.textContent = 'Please complete the CAPTCHA verification.';
            return;
        }
        if (btn) btn.disabled = true;
        try {
            try {
                sessionStorage.removeItem(PW_REC_STORAGE_KEY);
            } catch (_) { /* ignore */ }
            await signIn(email, password, captchaToken);
        } catch (err) {
            errEl.textContent = err.message || 'Sign in failed. Please check your email and password.';
            resetCaptcha(signInWidgetId);
        } finally {
            if (btn) btn.disabled = false;
        }
    });

    let signupCodeSent = false;

    function readSignupFields() {
        return {
            name: document.getElementById('signUpName').value.trim(),
            email: document.getElementById('signUpEmail').value.trim(),
            password: document.getElementById('signUpPassword').value,
            honeypot: document.getElementById('signUpWebsite')?.value || '',
            code: document.getElementById('signUpCode')?.value.trim() || '',
        };
    }

    function signupFieldError(fields, { needCaptcha, needCode }) {
        if (checkHoneypot(fields.honeypot)) return 'Signup failed. Please try again.';
        if (!fields.name || fields.name.length < 2) return 'Please enter your full name.';
        if (!isValidEmail(fields.email)) return 'Please enter a valid email address.';
        if (isDisposableEmail(fields.email)) return 'Temporary or disposable email addresses are not allowed. Please use a real email.';
        const pwdErr = getPasswordErrors(fields.password);
        if (pwdErr) return pwdErr;
        if (!document.getElementById('signUpAge')?.checked) return 'You must be at least 18 years old to create an account.';
        if (needCode && !/^\d{6}$/.test(fields.code)) return 'Enter the 6-digit code from your email.';
        if (needCaptcha && !getCaptchaToken(signUpWidgetId)) return 'Please complete the CAPTCHA verification.';
        return '';
    }

    function showSignupCodeStep() {
        signupCodeSent = true;
        const group = document.getElementById('signUpCodeGroup');
        const resend = document.getElementById('signUpResend');
        const btn = document.getElementById('signUpBtn');
        if (group) group.style.display = '';
        if (resend) resend.style.display = '';
        if (btn) btn.textContent = 'Create Account';
    }

    document.getElementById('signUpEmail')?.addEventListener('input', () => {
        if (!signupCodeSent) return;
        signupCodeSent = false;
        const group = document.getElementById('signUpCodeGroup');
        const resend = document.getElementById('signUpResend');
        const btn = document.getElementById('signUpBtn');
        const code = document.getElementById('signUpCode');
        if (group) group.style.display = 'none';
        if (resend) resend.style.display = 'none';
        if (btn) btn.textContent = 'Email me a code';
        if (code) code.value = '';
    });

    document.getElementById('signUpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fields = readSignupFields();
        const errEl = document.getElementById('signUpError');
        const btn = document.getElementById('signUpBtn');
        errEl.textContent = '';
        errEl.style.color = '';

        const problem = signupFieldError(fields, { needCaptcha: !signupCodeSent, needCode: signupCodeSent });
        if (problem) {
            errEl.textContent = problem;
            return;
        }

        if (btn) btn.disabled = true;
        try {
            if (!signupCodeSent) {
                await requestSignupCode(fields.email, fields.password, fields.name, getCaptchaToken(signUpWidgetId));
                showSignupCodeStep();
                errEl.textContent = 'We sent a 6-digit code to your email. Enter it below.';
                errEl.style.color = 'var(--accent-color)';
                resetCaptcha(signUpWidgetId);
                return;
            }
            const result = await verifySignupCode(fields.email, fields.password, fields.name, fields.code);
            if (result?.needsSignIn) {
                showTab('signin');
                const signInErr = document.getElementById('signInError');
                if (signInErr) {
                    signInErr.textContent = 'Account created. Sign in with your email and password.';
                    signInErr.style.color = 'var(--accent-color)';
                }
            }
        } catch (err) {
            errEl.textContent = err.message || 'Sign up failed. Please try again.';
            errEl.style.color = '';
            if (!signupCodeSent) resetCaptcha(signUpWidgetId);
        } finally {
            if (btn) btn.disabled = false;
        }
    });

    document.getElementById('signUpResend')?.addEventListener('click', async () => {
        const fields = readSignupFields();
        const errEl = document.getElementById('signUpError');
        const resend = document.getElementById('signUpResend');
        errEl.textContent = '';
        errEl.style.color = '';
        const problem = signupFieldError(fields, { needCaptcha: true, needCode: false });
        if (problem) {
            errEl.textContent = problem;
            return;
        }
        if (resend) resend.disabled = true;
        try {
            await requestSignupCode(fields.email, fields.password, fields.name, getCaptchaToken(signUpWidgetId));
            errEl.textContent = 'We sent a new code to your email.';
            errEl.style.color = 'var(--accent-color)';
            resetCaptcha(signUpWidgetId);
        } catch (err) {
            errEl.textContent = err.message || 'Could not send the verification email.';
            errEl.style.color = '';
            resetCaptcha(signUpWidgetId);
        } finally {
            if (resend) resend.disabled = false;
        }
    });

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value.trim();
        const phone = document.getElementById('profilePhone').value.trim();
        if (name.length < 2) {
            alert('Please enter a valid name.');
            return;
        }
        if (phone.length < 7) {
            alert('Please enter a valid phone number.');
            return;
        }
        try {
            await updateUserMetadata({ full_name: name, phone });
            document.getElementById('acctProfileEditPanel').style.display = 'none';
            const welcomeName = document.getElementById('acctWelcomeName');
            if (welcomeName) welcomeName.textContent = `Welcome, ${name}`;
            const avatar = document.getElementById('acctAvatar');
            if (avatar) {
                const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                avatar.textContent = initials;
            }
            alert('Profile updated.');
        } catch (err) {
            alert(err.message || 'Failed to update profile.');
        }
    });

    document.getElementById('acctEditProfileBtn').addEventListener('click', () => {
        document.getElementById('acctProfileEditPanel').style.display = 'block';
    });

    document.getElementById('acctCancelProfileBtn').addEventListener('click', () => {
        document.getElementById('acctProfileEditPanel').style.display = 'none';
    });

    const forgotShow = document.getElementById('forgotPasswordShowBtn');
    if (forgotShow) {
        forgotShow.addEventListener('click', () => showForgotPasswordPanel());
    }
    const forgotBack = document.getElementById('forgotPasswordBackBtn');
    if (forgotBack) {
        forgotBack.addEventListener('click', () => {
            const tabs = document.querySelector('.account-tabs');
            if (tabs) tabs.style.display = '';
            document.getElementById('forgotPasswordPanel').style.display = 'none';
            document.getElementById('signinForm').style.display = 'block';
            const fe = document.getElementById('forgotPasswordError');
            if (fe) fe.textContent = '';
            const success = document.getElementById('forgotPasswordSuccess');
            const form = document.getElementById('forgotPasswordForm');
            if (success) success.style.display = 'none';
            if (form) form.style.display = '';
        });
    }
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotPasswordEmail').value.trim();
            const errEl = document.getElementById('forgotPasswordError');
            const btn = document.getElementById('forgotPasswordSubmitBtn');
            const successEl = document.getElementById('forgotPasswordSuccess');
            const sentTo = document.getElementById('forgotPasswordSentTo');
            errEl.textContent = '';
            if (!isValidEmail(email)) {
                errEl.textContent = 'Please enter a valid email address.';
                return;
            }
            const rl = checkPasswordResetRateLimit();
            if (!rl.allowed) {
                errEl.textContent = rl.message;
                return;
            }
            if (btn) btn.disabled = true;
            try {
                await resetPasswordForEmail(email);
                if (sentTo) sentTo.textContent = email;
                forgotForm.style.display = 'none';
                if (successEl) successEl.style.display = 'block';
            } catch (err) {
                errEl.textContent = err.message || 'Could not send reset email. Try again later.';
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    const recoveryForm = document.getElementById('passwordRecoveryForm');
    if (recoveryForm) {
        recoveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pwd = document.getElementById('recoveryNewPassword').value;
            const confirm = document.getElementById('recoveryConfirmPassword').value;
            const errEl = document.getElementById('passwordRecoveryError');
            const btn = document.getElementById('passwordRecoverySubmitBtn');
            errEl.textContent = '';
            const pwdErr = getPasswordErrors(pwd);
            if (pwdErr) {
                errEl.textContent = pwdErr;
                return;
            }
            if (pwd !== confirm) {
                errEl.textContent = 'Passwords do not match.';
                return;
            }
            if (btn) btn.disabled = true;
            try {
                await updateUserPassword(pwd);
                inPasswordRecovery = false;
                try {
                    sessionStorage.removeItem(PW_REC_STORAGE_KEY);
                } catch (_) { /* ignore */ }
                try {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                } catch (_) { /* ignore */ }
                const user = await getCurrentUser();
                const tabs = document.querySelector('.account-tabs');
                if (tabs) tabs.style.display = '';
                document.getElementById('passwordRecoveryPanel').style.display = 'none';
                if (user) showLoggedIn(user);
                else showLoggedOut();
            } catch (err) {
                errEl.textContent = err.message || 'Could not update password.';
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const hadRecoveryHashAtLoad = hashHasRecoveryType();

    initAnimations();
    initCart();
    initAuthUI();
    initCheckout();

    setupTabs();
    setupForms();
    initTurnstile();

    onAuthChange(async (user, event) => {
        const recoveryFromStorage =
            user &&
            sessionStorage.getItem(PW_REC_STORAGE_KEY) === '1' &&
            (event === 'INITIAL_SESSION' || event === 'INITIAL_GET_USER' || event === 'TOKEN_REFRESHED');

        const recoveryFromLandingHash =
            user &&
            hadRecoveryHashAtLoad &&
            (event === 'INITIAL_SESSION' || event === 'INITIAL_GET_USER');

        const shouldRecover =
            event === 'PASSWORD_RECOVERY' || recoveryFromLandingHash || recoveryFromStorage;

        if (shouldRecover) {
            try {
                if (
                    event === 'PASSWORD_RECOVERY' ||
                    (user && hadRecoveryHashAtLoad && (event === 'INITIAL_SESSION' || event === 'INITIAL_GET_USER'))
                ) {
                    sessionStorage.setItem(PW_REC_STORAGE_KEY, '1');
                }
            } catch (_) { /* ignore */ }
            inPasswordRecovery = true;
            showPasswordRecoveryUI();
            return;
        }

        if (!user) {
            showLoggedOut();
            return;
        }

        if (inPasswordRecovery) {
            return;
        }

        showLoggedIn(user);
    });

    const user = await getCurrentUser();
    if (user && (hadRecoveryHashAtLoad || sessionStorage.getItem(PW_REC_STORAGE_KEY) === '1')) {
        inPasswordRecovery = true;
        showPasswordRecoveryUI();
    } else if (user) {
        showLoggedIn(user);
    } else {
        showLoggedOut();
    }
});
