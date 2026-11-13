import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductPicker } from '../components/ProductPicker';
import { api } from '../lib/api';
import { money, productImage } from '../lib/images';
import { isSoldByWeight } from '../lib/quantity';
import type { Product } from '../lib/types';

export function ProductPage() {
    const { id = '' } = useParams();
    const [open, setOpen] = useState(false);
    const products = useQuery({
        queryKey: ['products'],
        queryFn: () => api<Product[]>('/api/products'),
    });
    const product = products.data?.find((item) => item.id === id);
    const image = product ? productImage(product.image) : '';

    return (
        <section className="spad">
            <div className="container">
                <p className="checkout-note"><Link to="/shop">Back to the shop</Link></p>
                {products.isLoading && <p>Loading product…</p>}
                {products.isError && <p>This product could not be loaded.</p>}
                {!products.isLoading && !product && <p>This product is not in the shop.</p>}
                {product && (
                    <div className="product-detail">
                        <div className="product-detail__media">
                            {image ? <img src={image} alt={product.name} /> : <span>{product.fallbackEmoji || '🛒'}</span>}
                        </div>
                        <div>
                            <p className="checkout-kicker">{product.category}</p>
                            <h2>{product.name}</h2>
                            <p className="product-detail__price">{money(product.price)} <span>/ {product.unit}</span></p>
                            {product.description && <p>{product.description}</p>}
                            {isSoldByWeight(product.unit) && <p className="checkout-note">Final weight can vary by about 100 g.</p>}
                            {product.inStock ? (
                                <button className="checkout-submit" type="button" onClick={() => setOpen(true)}>Choose amount</button>
                            ) : (
                                <p className="form-error">Out of stock</p>
                            )}
                        </div>
                    </div>
                )}
                {product && open && <ProductPicker product={product} onClose={() => setOpen(false)} />}
            </div>
        </section>
    );
}
