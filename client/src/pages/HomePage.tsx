import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FeaturedCard } from '../components/ProductCard';
import { Hero } from '../components/Hero';
import { api } from '../lib/api';
import type { Product } from '../lib/types';

type Filter = 'all' | 'beef' | 'chicken' | 'lamb' | 'seafood';

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'beef', label: 'Beef' },
    { id: 'chicken', label: 'Chicken' },
    { id: 'lamb', label: 'Lamb & Goat' },
    { id: 'seafood', label: 'Seafood' },
];

function bucket(product: Product): Filter | null {
    const sub = (product.subcategory || '').toLowerCase();
    if (sub === 'beef' || sub === 'chicken' || sub === 'lamb' || sub === 'seafood') return sub as Filter;
    if (sub === 'goat') return 'lamb';
    const name = product.name.toLowerCase();
    if (/fish|tilapia|mackerel|salmon|shrimp|prawns?|catfish|croaker|seafood|crab|lobster|squid|octopus|oyster|clam|tuna|sardine|anchovy/.test(name)) return 'seafood';
    if (/chicken|turkey|poultry/.test(name)) return 'chicken';
    if (/lamb|goat|mutton/.test(name)) return 'lamb';
    if (/beef|oxtail|tongue|kidney|liver|steak|veal|mince/.test(name)) return 'beef';
    return null;
}

export function HomePage() {
    const [filter, setFilter] = useState<Filter>('all');
    const featured = useQuery({
        queryKey: ['featured'],
        queryFn: () => api<Product[]>('/api/products/featured'),
    });

    const visible = useMemo(() => {
        const items = featured.data ?? [];
        if (filter === 'all') return items;
        return items.filter((product) => bucket(product) === filter);
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
                                    {FILTERS.map((item) => (
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
                                        <a href={post.href} target="_blank" rel="noopener noreferrer">
                                            <img src={post.image} alt={post.title} loading="lazy" decoding="async" />
                                        </a>
                                    </div>
                                    <div className="blog__item__text">
                                        <h5><a href={post.href} target="_blank" rel="noopener noreferrer">{post.title}</a></h5>
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

const BLOG_POSTS = [
    {
        title: 'Understanding Halal Meat Quality',
        href: '/blog/understanding-halal-meat-quality.html',
        image: '/img/blog/blog01.webp',
        excerpt: 'Learn about what makes quality halal meat and how to identify the best cuts for your cooking.',
    },
    {
        title: '5 Tips for Perfect Biryani',
        href: '/blog/perfect-biryani-tips.html',
        image: '/img/blog/blog002.webp',
        excerpt: 'Master the art of cooking authentic biryani with these simple tips from our expert chefs.',
    },
    {
        title: 'Storing Fresh Meat Properly',
        href: '/blog/storing-fresh-meat-properly.html',
        image: '/img/blog/blog03.webp',
        excerpt: 'Essential tips for keeping your meat fresh and safe, from freezing to thawing methods.',
    },
];
