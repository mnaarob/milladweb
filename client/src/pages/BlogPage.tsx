export const BLOG_POSTS = [
    {
        title: 'Understanding Halal Meat Quality',
        href: '/blog/understanding-halal-meat-quality',
        image: '/img/blog/blog01.webp',
        excerpt: 'Learn about what makes quality halal meat and how to identify the best cuts for your cooking.',
    },
    {
        title: '5 Tips for Perfect Biryani',
        href: '/blog/perfect-biryani-tips',
        image: '/img/blog/blog002.webp',
        excerpt: 'Master the art of cooking authentic biryani with these simple tips from our expert chefs.',
    },
    {
        title: 'Storing Fresh Meat Properly',
        href: '/blog/storing-fresh-meat-properly',
        image: '/img/blog/blog03.webp',
        excerpt: 'Essential tips for keeping your meat fresh and safe, from freezing to thawing methods.',
    },
];

export function BlogPage() {
    return (
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
                        <div className="col-lg-4 col-md-4 col-sm-6" key={post.href}>
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
    );
}
