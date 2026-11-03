import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { ProductCard } from '../components/ProductCard';
import { Select } from '../components/Select';
import { api } from '../lib/api';
import type { Product } from '../lib/types';

type Sort = 'default' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

const SORT_OPTIONS = [
    { value: 'default', label: 'Default' },
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
    { value: 'price-asc', label: 'Price Low-High' },
    { value: 'price-desc', label: 'Price High-Low' },
];

const PRODUCTS_PER_PAGE = 12;
const MAX_PAGE_LINKS = 5;

export function ShopPage() {
    const [params] = useSearchParams();
    const category = params.get('category') || 'all';
    const query = (params.get('q') || '').trim().toLowerCase();
    const [sort, setSort] = useState<Sort>('default');
    const [page, setPage] = useState(1);

    const products = useQuery({
        queryKey: ['products'],
        queryFn: () => api<Product[]>('/api/products'),
        refetchOnWindowFocus: true,
    });

    const filtered = useMemo(() => {
        const items = (products.data ?? []).filter((product) => {
            if (category !== 'all' && product.category !== category) return false;
            if (query && !product.name.toLowerCase().includes(query)) return false;
            return true;
        }).slice();
        if (sort === 'name-asc') items.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === 'name-desc') items.sort((a, b) => b.name.localeCompare(a.name));
        else if (sort === 'price-asc') items.sort((a, b) => a.price - b.price);
        else if (sort === 'price-desc') items.sort((a, b) => b.price - a.price);
        return items;
    }, [products.data, category, query, sort]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));

    // Reset to the first page whenever the filter, search, or sort changes.
    useEffect(() => {
        setPage(1);
    }, [category, query, sort]);

    const safePage = Math.min(page, totalPages);
    const visible = useMemo(() => {
        const start = (safePage - 1) * PRODUCTS_PER_PAGE;
        return filtered.slice(start, start + PRODUCTS_PER_PAGE);
    }, [filtered, safePage]);

    function goTo(next: number) {
        setPage(Math.max(1, Math.min(totalPages, next)));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const pageLinks = useMemo(() => {
        let start = Math.max(1, safePage - Math.floor(MAX_PAGE_LINKS / 2));
        const end = Math.min(totalPages, start + MAX_PAGE_LINKS - 1);
        if (end - start + 1 < MAX_PAGE_LINKS) start = Math.max(1, end - MAX_PAGE_LINKS + 1);
        const links: number[] = [];
        for (let i = start; i <= end; i += 1) links.push(i);
        return links;
    }, [safePage, totalPages]);

    return (
        <>
            <Hero />

            <section className="product spad">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-12">
                            <div className="filter__item">
                                <div className="row">
                                    <div className="col-lg-4 col-md-5">
                                        <div className="filter__sort">
                                            <span>Sort By</span>
                                            <Select
                                                value={sort}
                                                options={SORT_OPTIONS}
                                                ariaLabel="Sort products"
                                                onChange={(value) => setSort(value as Sort)}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-lg-4 col-md-4">
                                        <div className="filter__found">
                                            <h6><span>{filtered.length}</span> Products found</h6>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="row">
                                {products.isLoading && <div className="loading col-12"><p>Loading products...</p></div>}
                                {products.isError && <div className="col-12"><p>Products could not be loaded.</p></div>}
                                {!products.isLoading && filtered.length === 0 && <div className="col-12"><p>No products match your search.</p></div>}
                                {visible.map((product) => <ProductCard key={product.id} product={product} />)}
                            </div>
                            {totalPages > 1 && (
                                <div className="row">
                                    <div className="col-12">
                                        <div className="product__pagination" id="shopPagination">
                                            <a
                                                href="#"
                                                className={safePage <= 1 ? 'disabled' : ''}
                                                aria-label="Previous"
                                                onClick={(event) => { event.preventDefault(); goTo(safePage - 1); }}
                                            >
                                                ‹
                                            </a>
                                            {pageLinks.map((number) => (
                                                <a
                                                    key={number}
                                                    href="#"
                                                    className={number === safePage ? 'active' : ''}
                                                    onClick={(event) => { event.preventDefault(); goTo(number); }}
                                                >
                                                    {number}
                                                </a>
                                            ))}
                                            <a
                                                href="#"
                                                className={safePage >= totalPages ? 'disabled' : ''}
                                                aria-label="Next"
                                                onClick={(event) => { event.preventDefault(); goTo(safePage + 1); }}
                                            >
                                                ›
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
