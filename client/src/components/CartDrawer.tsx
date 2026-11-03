import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { money, productImage } from '../lib/images';
import { formatAmount, isSoldByWeight, quantityStep } from '../lib/quantity';
import { useCart } from '../state/cart';

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const cart = useCart();

    useEffect(() => {
        if (!open) return;
        function onKey(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="cart-drawer" role="dialog" aria-modal="true" aria-label="Your cart">
            <div className="cart-drawer__backdrop" onClick={onClose} />
            <aside className="cart-drawer__panel">
                <header className="cart-drawer__header">
                    <h3>Your cart <span aria-label={`${cart.count} ${cart.count === 1 ? 'product' : 'products'}`}>{cart.count}</span></h3>
                    <button type="button" className="cart-drawer__close" aria-label="Close cart" onClick={onClose}>
                        <svg className="icon" aria-hidden="true"><use href="/img/icons.svg#icon-times" /></svg>
                    </button>
                </header>

                <div className="cart-drawer__items">
                    {cart.items.length === 0 && (
                        <div className="cart-drawer__empty">
                            <p>Your cart is empty.</p>
                            <Link to="/shop" className="cart-drawer__checkout" onClick={onClose}>Browse the shop</Link>
                        </div>
                    )}
                    {cart.items.map((item) => {
                        const image = productImage(item.image);
                        return (
                            <article className="cart-drawer__item" key={item.lineId}>
                                <div className="cart-drawer__thumb">
                                    {image ? <img src={image} alt="" /> : <span>{item.fallbackEmoji || '🛒'}</span>}
                                </div>
                                <div className="cart-drawer__info">
                                    <div className="cart-drawer__row">
                                        <h4>{item.name}</h4>
                                        <strong>{money(Math.round(item.price * item.quantity * 100) / 100)}</strong>
                                    </div>
                                    <p>{money(item.price)} / {item.unit}</p>
                                    {isSoldByWeight(item.unit) && <p className="product-weight-note">Final weight can vary by about 100 g.</p>}
                                    <div className="cart-drawer__actions">
                                        <div className="qty-stepper" role="group" aria-label={`Quantity for ${item.name}`}>
                                            <button type="button" aria-label="Decrease quantity" disabled={item.quantity <= (isSoldByWeight(item.unit) ? 1 : 0)} onClick={() => cart.setQuantity(item.lineId, item.quantity - quantityStep(item.unit))}>−</button>
                                            <span>{formatAmount(item.quantity)}{isSoldByWeight(item.unit) ? ' kg' : ''}</span>
                                            <button type="button" aria-label="Increase quantity" onClick={() => cart.setQuantity(item.lineId, item.quantity + quantityStep(item.unit))}>+</button>
                                        </div>
                                        <button type="button" className="cart-drawer__remove" onClick={() => cart.remove(item.lineId)}>Remove</button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>

                {cart.items.length > 0 && (
                    <footer className="cart-drawer__footer">
                        <dl>
                            <div><dt>Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
                            <div><dt>GST (5%)</dt><dd>{money(cart.gst)}</dd></div>
                            <div><dt>PST (7%)</dt><dd>{money(cart.pst)}</dd></div>
                            <div className="is-total"><dt>Total (CAD)</dt><dd>{money(cart.total)}</dd></div>
                        </dl>
                        <Link className="cart-drawer__checkout" to="/checkout" onClick={onClose}>Checkout</Link>
                    </footer>
                )}
            </aside>
        </div>
    );
}
