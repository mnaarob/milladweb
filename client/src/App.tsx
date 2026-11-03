import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SiteShell } from './components/SiteShell';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { HomePage } from './pages/HomePage';
import { LegalPage } from './pages/LegalPage';
import privacySource from '../../frontend/privacy-policy.html?raw';
import termsSource from '../../frontend/terms.html?raw';
import { ShopPage } from './pages/ShopPage';
import { CartProvider } from './state/cart';
import { SessionProvider } from './state/session';

const queryClient = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 30_000 } },
});

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <SessionProvider>
                <CartProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="admin" element={<AdminPage />} />
                            <Route element={<SiteShell />}>
                                <Route index element={<HomePage />} />
                                <Route path="shop" element={<ShopPage />} />
                                <Route path="checkout" element={<CheckoutPage />} />
                                <Route path="account" element={<AccountPage />} />
                                <Route path="privacy" element={<LegalPage source={privacySource} title="Privacy Policy" />} />
                                <Route path="privacy-policy" element={<LegalPage source={privacySource} title="Privacy Policy" />} />
                                <Route path="terms" element={<LegalPage source={termsSource} title="Terms & Conditions" />} />
                                <Route path="blog" element={<LegalPage file="/blog.html" title="Blog" />} />
                                <Route path="blog-details" element={<LegalPage file="/blog-details.html" title="Blog" />} />
                                <Route path="blog-post" element={<LegalPage file="/blog-post.html" title="Blog" />} />
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </CartProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
}
