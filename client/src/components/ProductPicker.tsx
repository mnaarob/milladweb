import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { money, productImage } from '../lib/images';
import { formatAmount, isSoldByWeight } from '../lib/quantity';
import type { Product } from '../lib/types';
import { useCart } from '../state/cart';

export function ProductPicker({ product, onClose }: { product: Product; onClose: () => void }) {
    const cart = useCart();
    const weight = isSoldByWeight(product.unit);
    const [amount, setAmount] = useState(1);
    const [typed, setTyped] = useState('1');
    const image = productImage(product.image);

    useEffect(() => {
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
    }, [onClose]);

    function setPieces(next: number) {
        const value = Math.min(99, Math.max(1, Math.floor(next)));
        setAmount(value);
        setTyped(String(value));
    }

    function add(event: FormEvent) {
        event.preventDefault();
        if (!product.inStock) return;
        const quantity = weight ? amount : Math.min(99, Math.max(1, Math.floor(Number(typed)) || 1));
        cart.add(product, quantity);
        onClose();
    }

    return createPortal(
        <div className="product-picker" role="dialog" aria-modal="true" aria-labelledby="product-picker-title">
            <div className="product-picker__backdrop" onClick={onClose} />
            <form className="product-picker__panel" onSubmit={add}>
                <button type="button" className="cart-drawer__close" aria-label="Close" onClick={onClose}>
                    <svg className="icon" aria-hidden="true"><use href="/img/icons.svg#icon-times" /></svg>
                </button>
                <div className="product-picker__media">
                    {image ? <img src={image} alt="" /> : <span>{product.fallbackEmoji || '🛒'}</span>}
                </div>
                <div className="product-picker__body">
                    <h3 id="product-picker-title">{product.name}</h3>
                    <p className="product-picker__price">{money(product.price)} <span>/ {product.unit}</span></p>
                    {product.inStock ? (
                        <>
                            <p className="checkout-label">{weight ? 'Weight' : 'Quantity'}</p>
                            <div className="product-picker__qty">
                                <button
                                    type="button"
                                    aria-label={weight ? 'Decrease weight' : 'Decrease quantity'}
                                    disabled={amount <= 1}
                                    onClick={() => (weight ? setAmount((value) => Math.max(1, Math.round((value - 0.5) * 2) / 2)) : setPieces(amount - 1))}
                                >
                                    −
                                </button>
                                {weight ? (
                                    <strong>{formatAmount(amount)} kg</strong>
                                ) : (
                                    <input
                                        aria-label="Quantity"
                                        inputMode="numeric"
                                        min={1}
                                        max={99}
                                        value={typed}
                                        onChange={(event) => {
                                            const next = event.target.value.replace(/[^\d]/g, '');
                                            setTyped(next);
                                            if (next) setAmount(Math.min(99, Math.max(1, Number(next))));
                                        }}
                                        onBlur={() => setPieces(Number(typed) || 1)}
                                    />
                                )}
                                <button
                                    type="button"
                                    aria-label={weight ? 'Increase weight' : 'Increase quantity'}
                                    onClick={() => (weight ? setAmount((value) => Math.min(99, Math.round((value + 0.5) * 2) / 2)) : setPieces(amount + 1))}
                                >
                                    +
                                </button>
                            </div>
                            {weight && <p className="product-weight-note">Final weight can vary by about 100 g.</p>}
                            <p className="product-picker__line">{money(product.price * (weight ? amount : Math.max(1, Number(typed) || 1)))}</p>
                            <button className="checkout-submit" type="submit">Add to cart</button>
                        </>
                    ) : (
                        <p className="product-picker__soldout">Out of stock</p>
                    )}
                </div>
            </form>
        </div>,
        document.body,
    );
}
