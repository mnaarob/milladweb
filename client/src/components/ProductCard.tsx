import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money, productImage } from '../lib/images';
import { isSoldByWeight } from '../lib/quantity';
import type { Product } from '../lib/types';
import { ProductPicker } from './ProductPicker';

function openPicker(event: { preventDefault: () => void; stopPropagation: () => void }, setOpen: (open: boolean) => void) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
}

export function FeaturedCard({ product }: { product: Product }) {
    const image = productImage(product.image);
    const [open, setOpen] = useState(false);
    const outOfStock = !product.inStock;
    return (
        <div className="col-6 col-lg-3 col-md-4 col-sm-6" data-product-id={product.id}>
            <div className="featured__item product-card">
                <div
                    className={image ? 'featured__item__pic set-bg' : 'featured__item__pic'}
                    style={image ? { backgroundImage: `url(${image})` } : undefined}
                >
                    <Link className="product-card__open" to={`/product/${product.id}`} aria-label={product.name} />
                    {!image && (
                        <div className="product-emoji" style={{ fontSize: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            {product.fallbackEmoji || '🛒'}
                        </div>
                    )}
                    <ul className="featured__item__pic__hover">
                        <li>
                            {outOfStock ? <SoldOutMark /> : (
                                <a href="#cart" aria-label={`Choose amount of ${product.name}`} onClick={(event) => openPicker(event, setOpen)}>
                                    <svg className="icon icon-shopping-cart" aria-hidden="true"><use href="/img/icons.svg#icon-shopping-cart" /></svg>
                                </a>
                            )}
                        </li>
                    </ul>
                </div>
                <div className="featured__item__text">
                    <h6><Link to={`/product/${product.id}`}>{product.name}</Link></h6>
                    <h5>{money(product.price)}/{product.unit}</h5>
                    {isSoldByWeight(product.unit) && <p className="product-weight-note">Final weight can vary by about 100 g.</p>}
                </div>
            </div>
            {open && <ProductPicker product={product} onClose={() => setOpen(false)} />}
        </div>
    );
}

function SoldOutMark() {
    return (
        <span className="out-of-stock-btn" title="Out of stock" aria-label="Out of stock">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <path d="M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
        </span>
    );
}

export function ProductCard({ product }: { product: Product }) {
    const image = productImage(product.image);
    const [open, setOpen] = useState(false);
    const outOfStock = !product.inStock;
    return (
        <div className="col-6 col-lg-4 col-md-6 col-sm-6" data-product-id={product.id}>
            <div className={`product__item product-card${outOfStock ? ' product__item--out-of-stock' : ''}`}>
                <div className="product__item__pic">
                    <Link className="product-card__open" to={`/product/${product.id}`} aria-label={product.name} />
                    {image
                        ? <img src={image} alt="" loading="lazy" decoding="async" />
                        : <div className="product-emoji">{product.fallbackEmoji || '🛒'}</div>}
                    {outOfStock && <div className="out-of-stock-badge">Out of Stock</div>}
                    <ul className="product__item__pic__hover">
                        <li>
                            {outOfStock ? <SoldOutMark /> : (
                                <a href="#cart" aria-label={`Choose amount of ${product.name}`} onClick={(event) => openPicker(event, setOpen)}>
                                    <svg className="icon icon-shopping-cart" aria-hidden="true"><use href="/img/icons.svg#icon-shopping-cart" /></svg>
                                </a>
                            )}
                        </li>
                    </ul>
                </div>
                <div className="product__item__text">
                    <h6><Link to={`/product/${product.id}`}>{product.name}</Link></h6>
                    <span>{product.unit}</span>
                    <h5>{outOfStock ? <span className="price-muted">{money(product.price)}</span> : money(product.price)}</h5>
                    {isSoldByWeight(product.unit) && <p className="product-weight-note">Final weight can vary by about 100 g.</p>}
                </div>
            </div>
            {open && <ProductPicker product={product} onClose={() => setOpen(false)} />}
        </div>
    );
}
