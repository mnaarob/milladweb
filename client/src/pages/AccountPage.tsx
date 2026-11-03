import { FormEvent, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TurnstileWidget, type TurnstileHandle } from '../components/TurnstileWidget';
import { api } from '../lib/api';
import { signInWithGuard, requestSignupCode, supabase, verifySignupCode } from '../lib/supabase';
import { money } from '../lib/images';
import type { OrderRecord } from '../lib/types';
import { useSession } from '../state/session';

export function AccountPage() {
    const session = useSession();
    const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [age, setAge] = useState(false);
    const [code, setCode] = useState('');
    const [codeStep, setCodeStep] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const captcha = useRef<TurnstileHandle>(null);
    const orders = useQuery({
        queryKey: ['my-orders', session.user?.id],
        enabled: Boolean(session.token),
        queryFn: () => api<OrderRecord[]>('/api/account/orders', { token: session.token }),
    });

    async function submit(event: FormEvent) {
        event.preventDefault();
        setError('');
        setMessage('');
        if (mode === 'signup' && !age) {
            setError('You must be at least 18 years old to create an account.');
            return;
        }
        if (mode === 'signup' && codeStep) {
            setBusy(true);
            try {
                const result = await verifySignupCode(email, password, fullName, code);
                if (result.needsSignIn) {
                    setMessage('Account created. Sign in with your email and password.');
                    setMode('signin');
                    setCodeStep(false);
                    setCode('');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not create the account. Please try again.');
            } finally {
                setBusy(false);
            }
            return;
        }
        if (mode === 'reset') {
            const { error: resetError } = await api<{ ok: boolean }>('/api/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            }).then(() => ({ error: null })).catch((err: Error) => ({ error: err }));
            if (resetError) setError(resetError.message);
            else setMessage('If an account exists for that email, a reset link is on its way.');
            return;
        }
        const captchaToken = captcha.current?.getToken() ?? '';
        if (!captchaToken) {
            setError('Complete the check above.');
            return;
        }
        if (mode === 'signup') {
            setBusy(true);
            try {
                await requestSignupCode(email, password, fullName, captchaToken);
                setCodeStep(true);
                setMessage(`We sent a 6-digit code to ${email}. Enter it below to create the account.`);
                captcha.current?.reset();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not send the verification email.');
                captcha.current?.reset();
            } finally {
                setBusy(false);
            }
            return;
        }
        try {
            await signInWithGuard(email, password, captchaToken);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign in failed. Please check your email and password.');
            captcha.current?.reset();
        }
    }

    if (session.loading) return <section className="spad"><div className="container"><p>Loading…</p></div></section>;

    if (!session.user) {
        const title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';
        const intro = mode === 'signup'
            ? 'We will email you a 6-digit code to confirm the account.'
            : mode === 'reset'
                ? 'We will email a link to choose a new password.'
                : 'Use the email and password for your Millad\'s account.';
        return (
            <section className="spad">
                <div className="container">
                    <form className="auth-card" onSubmit={submit}>
                        <h2>{title}</h2>
                        <p className="auth-card__intro">{intro}</p>
                        {mode === 'signup' && (
                            <label className="checkout-field">
                                <span>Name</span>
                                <input required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                            </label>
                        )}
                        <label className="checkout-field">
                            <span>Email</span>
                            <input type="email" required autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setCodeStep(false); setCode(''); }} />
                        </label>
                        {mode !== 'reset' && (
                            <label className="checkout-field">
                                <span>Password</span>
                                <input type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />
                            </label>
                        )}
                        {mode === 'signup' && codeStep && (
                            <label className="checkout-field">
                                <span>Email code</span>
                                <input
                                    required
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    value={code}
                                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                />
                            </label>
                        )}
                        {mode === 'signup' && (
                            <label className="age-confirm">
                                <input type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} /> I am at least 18 years old
                            </label>
                        )}
                        {mode !== 'reset' && <TurnstileWidget key={mode} ref={captcha} />}
                        {error && <p className="form-error">{error}</p>}
                        {message && <p className="auth-card__note">{message}</p>}
                        <button className="checkout-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? (codeStep ? 'Create account' : 'Email me a code') : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
                        <div className="auth-card__links">
                            {mode === 'reset' ? (
                                <button type="button" onClick={() => { setMode('signin'); setCodeStep(false); setCode(''); }}>Back to sign in</button>
                            ) : (
                                <>
                                    <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setCodeStep(false); setCode(''); setError(''); setMessage(''); }}>
                                        {mode === 'signin' ? 'Need an account?' : 'Have an account?'}
                                    </button>
                                    {mode === 'signin' && <button type="button" onClick={() => { setMode('reset'); setCodeStep(false); setCode(''); }}>Forgot password</button>}
                                    {mode === 'signup' && codeStep && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={async () => {
                                                setError('');
                                                setMessage('');
                                                const captchaToken = captcha.current?.getToken() ?? '';
                                                if (!captchaToken) {
                                                    setError('Complete the check above to send a new code.');
                                                    return;
                                                }
                                                setBusy(true);
                                                try {
                                                    await requestSignupCode(email, password, fullName, captchaToken);
                                                    setMessage(`We sent a new code to ${email}.`);
                                                    captcha.current?.reset();
                                                } catch (err) {
                                                    setError(err instanceof Error ? err.message : 'Could not send the verification email.');
                                                    captcha.current?.reset();
                                                } finally {
                                                    setBusy(false);
                                                }
                                            }}
                                        >
                                            Send a new code
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </form>
                </div>
            </section>
        );
    }

    return (
        <section className="spad">
            <div className="container">
                <div className="auth-card">
                    <h2>Your account</h2>
                    <p className="auth-card__intro">{session.user.email}</p>
                    <p className="checkout-note">These are the orders placed with this account.</p>
                    <div className="auth-card__links">
                        <button type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
                    </div>
                    {orders.isLoading && <p className="checkout-note">Loading orders…</p>}
                    {orders.data?.length === 0 && <p className="checkout-note">No orders yet.</p>}
                    <ul className="auth-orders">
                        {orders.data?.map((order) => (
                            <li key={order.id}>
                                <strong>#{order.id.slice(-6).toUpperCase()}</strong>
                                <span>{order.status}</span>
                                <b>{money(order.pricing.total)} CAD</b>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
