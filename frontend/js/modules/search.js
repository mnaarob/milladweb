/**
 * Hero / shop search box.
 * - Shop: `onSearch` runs on input and on submit (SEARCH button).
 * - Home: optional `featuredFilter` filters featured grid; `navigateToShopOnSubmit` sends query to `/shop?q=…`.
 */
export function initSearch(options = {}) {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const form = searchInput.closest('form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const raw = searchInput.value;
            const trimmed = raw.trim();

            if (options.navigateToShopOnSubmit && trimmed) {
                window.location.href = `/shop?q=${encodeURIComponent(trimmed)}`;
                return;
            }

            if (options.onSearch) {
                options.onSearch(raw);
            }
        });
    }

    if (options.onSearch) {
        searchInput.addEventListener('input', (e) => {
            options.onSearch(e.target.value);
        });
    }

    if (options.featuredFilter) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.featured__filter .mix').forEach((item) => {
                const name =
                    item.querySelector('.featured__item__text h6')?.textContent?.toLowerCase() || '';
                item.style.display = name.includes(query) ? '' : 'none';
            });
        });
    }
}
