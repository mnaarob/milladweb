import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Category } from '../lib/types';

export function Hero({ showBanner = false }: { showBanner?: boolean }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const categories = useQuery({
        queryKey: ['categories'],
        queryFn: () => api<Category[]>('/api/categories'),
    });

    function search(event: FormEvent) {
        event.preventDefault();
        const query = term.trim();
        navigate(query ? `/shop?q=${encodeURIComponent(query)}` : '/shop');
    }

    function pickCategory(slug: string) {
        setOpen(false);
        navigate(slug === 'all' ? '/shop' : `/shop?category=${encodeURIComponent(slug)}`);
    }

    return (
        <section className={`hero hero-normal${showBanner ? ' hero--home' : ''}`}>
            <div className="container">
                <div className="row">
                    <div className="col-lg-3">
                        <div className={`hero__categories${open ? ' hero__categories--open' : ''}`}>
                            <div
                                className="hero__categories__all"
                                role="button"
                                tabIndex={0}
                                onClick={() => setOpen((value) => !value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setOpen((value) => !value);
                                    }
                                }}
                            >
                                <svg className="icon icon-bars" aria-hidden="true"><use href="/img/icons.svg#icon-bars" /></svg>
                                <span>All Categories</span>
                            </div>
                            <ul>
                                <li><a href="/shop" onClick={(event) => { event.preventDefault(); pickCategory('all'); }}>All Products</a></li>
                                {categories.data?.map((category) => (
                                    <li key={category.id}>
                                        <a
                                            href={`/shop?category=${encodeURIComponent(category.id)}`}
                                            onClick={(event) => { event.preventDefault(); pickCategory(category.id); }}
                                        >
                                            {category.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="col-lg-9">
                        <div className="hero__search">
                            <div className="hero__search__form">
                                <form onSubmit={search} role="search">
                                    <input
                                        type="text"
                                        value={term}
                                        onChange={(event) => setTerm(event.target.value)}
                                        autoComplete="off"
                                        placeholder="What are you looking for?"
                                        aria-label="Search products"
                                    />
                                    <button type="submit" className="site-btn">SEARCH</button>
                                </form>
                            </div>
                            <a className="hero__search__phone" href="tel:+12049479558" aria-label="Call Millad's Supermarket at (204) 947-9558">
                                <div className="hero__search__phone__icon">
                                    <svg className="icon icon-phone" aria-hidden="true"><use href="/img/icons.svg#icon-phone" /></svg>
                                </div>
                                <div className="hero__search__phone__text">
                                    <h5>(204) 947-9558</h5>
                                    <span>Pickup Available</span>
                                </div>
                            </a>
                        </div>
                        {showBanner && (
                            <div className="hero__item">
                                <picture className="hero__media">
                                    <source
                                        type="image/webp"
                                        srcSet="/images/meat/heroimage2-640.webp 640w, /images/meat/heroimage2-1024.webp 1024w, /images/meat/heroimage2.webp 1600w"
                                        sizes="(max-width: 991px) 100vw, 75vw"
                                    />
                                    <img src="/images/meat/heroimage2.webp" width={1600} height={900} alt="" fetchPriority="high" decoding="async" />
                                </picture>
                                <div className="hero__text">
                                    <span>HALAL</span>
                                    <h2>Fresh Meat <br />&amp; Groceries</h2>
                                    <p>Quality halal products ready for pickup</p>
                                    <a href="/shop" className="primary-btn">SHOP NOW</a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
