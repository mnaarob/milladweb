import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DELIVERY_FEE, DELIVERY_SLOTS, FREE_DELIVERY_AT, deliveryFee, type DeliverySlot } from '../lib/delivery';
import { money, productImage } from '../lib/images';
import { formatAmount, isSoldByWeight } from '../lib/quantity';
import { api } from '../lib/api';
import { useCart } from '../state/cart';
import { useSession } from '../state/session';

function withCanadaPrefix(value: string) {
    const trimmed = value.trimStart();
    if (trimmed.startsWith('+1')) return value.startsWith('+1') ? value : `+1${trimmed.slice(2)}`;
    const digits = value.replace(/\D/g, '').replace(/^1/, '');
    return `+1 ${digits}`;
}

function isStorePhone(value: string) {
    const trimmed = value.trim();
    if (!trimmed.startsWith('+1')) return false;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('1');
}

export function CheckoutPage() {
    const cart = useCart();
    const session = useSession();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('+1 ');
    const [email, setEmail] = useState(session.user?.email ?? '');
    const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
    const [address, setAddress] = useState('');
    const [slot, setSlot] = useState<DeliverySlot | ''>('');
    const [age, setAge] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [placed, setPlaced] = useState<{ id: string; fulfillment: 'pickup' | 'delivery'; slot: string } | null>(null);

    useEffect(() => {
        if (session.user?.email) setEmail((current) => current || session.user?.email || '');
    }, [session.user?.email]);

    const fee = deliveryFee(cart.subtotal, fulfillment);
    const total = Math.round((cart.total + fee) * 100) / 100;
    const untilFree = Math.round((FREE_DELIVERY_AT - cart.subtotal) * 100) / 100;
    const slotLabel = DELIVERY_SLOTS.find((option) => option.value === slot)?.label;

    async function submit(event: FormEvent) {
        event.preventDefault();
        setError('');
        if (name.trim().length < 2) {
            setError('Enter your name.');
            return;
        }
        if (!isStorePhone(phone)) {
            setError('Phone number must start with +1 and include 10 digits.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError('Enter an email address.');
            return;
        }
        if (!age) {
            setError('You must be at least 18 years old to place an order.');
            return;
        }
        if (fulfillment === 'delivery' && address.trim().length < 5) {
            setError('Enter a delivery address with the street, Winnipeg, and postal code.');
            return;
        }
        if (fulfillment === 'delivery' && !slot) {
            setError('Choose a delivery time.');
            return;
        }
        setBusy(true);
        try {
            const result = await api<{ id: string }>('/api/orders', {
                method: 'POST',
                token: session.token,
                body: JSON.stringify({
                    ageConfirmed: true,
                    customer: {
                        name,
                        phone,
                        email,
                        fulfillment,
                        deliveryAddress: address,
                        ...(fulfillment === 'delivery' && slot ? { deliverySlot: slot } : {}),
                    },
                    items: cart.items.map((item) => ({ id: item.id, quantity: item.quantity, notes: item.notes })),
                    pricing: { total },
                }),
            });
            setPlaced({ id: result.id, fulfillment, slot: slotLabel ?? '' });
            cart.clear();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Order could not be placed');
        } finally {
            setBusy(false);
        }
    }

    if (placed) {
        return (
            <section className="spad">
                <div className="container">
                    <div className="checkout-done">
                        <p className="checkout-kicker">Order received</p>
                        <h2>We have order #{placed.id.slice(-6).toUpperCase()}</h2>
                        {placed.fulfillment === 'delivery' ? (
                            <p>Delivery window: {placed.slot}. Arrival can be about 20–30 minutes earlier or later, depending on the day. This order is confirmed when the store calls you. The final amount can change with actual weight.</p>
                        ) : (
                            <p>This order is confirmed when the store calls you. The final amount can change with actual weight. Typical pickup timing is 2–4 hours.</p>
                        )}
                        <Link className="checkout-submit" to="/shop">Back to the shop</Link>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="spad">
            <div className="container">
                <form className="checkout" onSubmit={submit}>
                    <div className="checkout__grid">
                        <div>
                            <h2>Checkout</h2>
                            <section className="checkout-card">
                                <h3>Contact</h3>
                                <label className="checkout-field">
                                    <span>Name</span>
                                    <input required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
                                </label>
                                <label className="checkout-field">
                                    <span>Phone</span>
                                    <input
                                        required
                                        type="tel"
                                        autoComplete="tel"
                                        inputMode="tel"
                                        placeholder="+1 204-555-0100"
                                        aria-describedby="checkout-phone-hint"
                                        value={phone}
                                        onChange={(event) => setPhone(withCanadaPrefix(event.target.value))}
                                    />
                                    <small id="checkout-phone-hint">Start with +1, then your 10-digit number.</small>
                                </label>
                                <label className="checkout-field">
                                    <span>Email</span>
                                    <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                                </label>
                            </section>

                            <section className="checkout-card">
                                <h3>Fulfillment</h3>
                                <div className="choice-row" role="radiogroup" aria-label="Fulfillment">
                                    <label className={fulfillment === 'pickup' ? 'is-selected' : ''}>
                                        <input type="radio" name="fulfillment" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} />
                                        <strong>Pickup</strong>
                                        <span>460 Notre Dame Avenue</span>
                                    </label>
                                    <label className={fulfillment === 'delivery' ? 'is-selected' : ''}>
                                        <input type="radio" name="fulfillment" checked={fulfillment === 'delivery'} onChange={() => setFulfillment('delivery')} />
                                        <strong>Delivery</strong>
                                        <span>Winnipeg only</span>
                                    </label>
                                </div>

                                {fulfillment === 'delivery' && (
                                    <>
                                        <label className="checkout-field">
                                            <span>Delivery address</span>
                                            <input required minLength={5} autoComplete="street-address" placeholder="Street, Winnipeg, postal code" value={address} onChange={(event) => setAddress(event.target.value)} />
                                        </label>
                                        <p className="checkout-label">Delivery time</p>
                                        <div className="choice-row" role="radiogroup" aria-label="Delivery time">
                                            {DELIVERY_SLOTS.map((option) => (
                                                <label key={option.value} className={slot === option.value ? 'is-selected' : ''}>
                                                    <input
                                                        type="radio"
                                                        name="delivery-slot"
                                                        checked={slot === option.value}
                                                        onChange={() => setSlot(option.value)}
                                                    />
                                                    <strong>{option.label}</strong>
                                                    <span>{option.hint}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="checkout-note">Arrival can be about 20–30 minutes earlier or later, depending on the day.</p>
                                    </>
                                )}
                            </section>

                            <div className="checkout-legal">
                                <p>
                                    Millad&apos;s Supermarket, 460 Notre Dame Avenue, Winnipeg, Manitoba.
                                    Total {money(total)} CAD. GST {money(cart.gst)} and PST {money(cart.pst)} are included where the item is taxable.
                                    {fulfillment === 'delivery'
                                        ? ` Delivery is ${money(DELIVERY_FEE)} when the order is under ${money(FREE_DELIVERY_AT)} before tax, and free at ${money(FREE_DELIVERY_AT)} or more. Windows are 2:00 PM and 8:00 PM. Arrival can be about 20–30 minutes earlier or later.`
                                        : ' Pickup is at the store. Typical timing is 2–4 hours.'}
                                    {' '}Payment is cash. Sending this form is an offer, not a contract. Your rights under the Sale of Goods Act (Manitoba) and the Consumer Protection Act stay in place.{' '}
                                    <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link>
                                </p>
                            </div>
                            <label className="age-confirm">
                                <input type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} />
                                I am at least 18 years old
                            </label>
                        </div>

                        <aside className="checkout-card checkout-summary">
                            <h3>Your order</h3>
                            {cart.items.length === 0 && <p className="checkout-note">Your cart is empty.</p>}
                            <ul className="checkout-lines">
                                {cart.items.map((item) => {
                                    const image = productImage(item.image);
                                    return (
                                        <li key={item.lineId}>
                                            <div className="checkout-lines__thumb">
                                                {image ? <img src={image} alt="" /> : <span>{item.fallbackEmoji}</span>}
                                            </div>
                                            <div>
                                                <strong>{item.name}</strong>
                                                <span>{isSoldByWeight(item.unit) ? `${formatAmount(item.quantity)} kg` : `Qty ${item.quantity}`}</span>
                                            </div>
                                            <b>{money(item.price * item.quantity)}</b>
                                        </li>
                                    );
                                })}
                            </ul>
                            <dl>
                                <div><dt>Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
                                <div><dt>GST (5%)</dt><dd>{money(cart.gst)}</dd></div>
                                <div><dt>PST (7%)</dt><dd>{money(cart.pst)}</dd></div>
                                {fulfillment === 'delivery' && (
                                    <div>
                                        <dt>Delivery</dt>
                                        <dd>{fee === 0 ? 'Free' : money(fee)}</dd>
                                    </div>
                                )}
                                <div className="is-total"><dt>Total (CAD)</dt><dd>{money(total)}</dd></div>
                            </dl>
                            {fulfillment === 'delivery' && untilFree > 0 && (
                                <p className="checkout-note">Add {money(untilFree)} for free delivery.</p>
                            )}
                            {fulfillment === 'delivery' && untilFree <= 0 && cart.items.length > 0 && (
                                <p className="checkout-note">Free delivery on this order.</p>
                            )}
                            {error && <p className="form-error">{error}</p>}
                            <button className="checkout-submit" type="submit" disabled={busy || cart.items.length === 0}>
                                {busy ? 'Sending…' : 'Place order'}
                            </button>
                            <p className="checkout-pay">Cash on {fulfillment === 'delivery' ? 'delivery' : 'pickup'}</p>
                        </aside>
                    </div>
                </form>
            </div>
        </section>
    );
}
