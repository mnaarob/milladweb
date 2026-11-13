import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FeaturedCard } from '../components/ProductCard';
import { Hero } from '../components/Hero';
import { api } from '../lib/api';
import { MEAT_FILTERS, meatBucket, type MeatFilter } from '../lib/meat';
import type { Product } from '../lib/types';
import { BLOG_POSTS } from './BlogPage';

export function HomePage() {
    const [filter, setFilter] = useState<MeatFilter>('all');
    const featured = useQuery({
        queryKey: ['featured'],
        queryFn: () => api<Product[]>('/api/products/featured'),
    });

    const visible = useMemo(() => {
        const items = featured.data ?? [];
        if (filter === 'all') return items;
        return items.filter((product) => meatBucket(product) === filter);
    }, [featured.data, filter]);

    return (
        <>
            <Hero showBanner />

            <section className="featured spad" id="featured">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-12">
                            <div className="section-title">
                                <h2>Featured Products</h2>
                            </div>
                            <div className="featured__controls">
                                <ul>
                                    {MEAT_FILTERS.map((item) => (
                                        <li
                                            key={item.id}
                                            className={filter === item.id ? 'active' : ''}
                                            onClick={() => setFilter(item.id)}
                                        >
                                            {item.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="row featured__filter">
                        {featured.isLoading && <div className="col-12 loading"><p>Loading products...</p></div>}
                        {featured.isError && <div className="col-12"><p>Products could not be loaded.</p></div>}
                        {visible.map((product) => <FeaturedCard key={product.id} product={product} />)}
                    </div>
                </div>
            </section>

            <section className="from-blog spad">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-12">
                            <div className="section-title from-blog__title">
                                <h2>From The Blog</h2>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        {BLOG_POSTS.map((post) => (
                            <div className="col-lg-4 col-md-4 col-sm-6" key={post.title}>
                                <div className="blog__item">
                                    <div className="blog__item__pic">
                                        <a href={post.href}>
                                            <img src={post.image} alt={post.title} loading="lazy" decoding="async" />
                                        </a>
                                    </div>
                                    <div className="blog__item__text">
                                        <h5><a href={post.href}>{post.title}</a></h5>
                                        <p>{post.excerpt}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
