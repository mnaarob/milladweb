import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCart } from '../state/cart';
import { useSession } from '../state/session';
import { CartDrawer } from './CartDrawer';
import { CircleIconButton } from './CircleIconButton';
import { SocialLinks } from './SocialLinks';

export function SiteShell() {
    const cart = useCart();
    const session = useSession();
    const [cartOpen, setCartOpen] = useState(false);

    return (
        <>
            <header className="header">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-3">
                            <div className="header__logo">
                                <Link to="/"><h2 style={{ color: '#2D6A4F', fontWeight: 700 }}>Millad&apos;s Supermarket</h2></Link>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <nav className="header__menu">
                                <ul>
                                    <li><NavLink to="/">Home</NavLink></li>
                                    <li><NavLink to="/shop">Shop</NavLink></li>
                                    {session.isStaff && <li><NavLink to="/admin">Dashboard</NavLink></li>}
                                    <li><a href="#contact-info">Contact</a></li>
                                </ul>
                            </nav>
                        </div>
                        <div className="col-lg-3">
                            <div className="header__cart" role="toolbar" aria-label="Cart and account">
                                <ul className="example-2">
                                    <CircleIconButton icon="/img/icons.svg#icon-shopping-bag" label="Cart" brand="cart" badge={cart.count} onClick={() => setCartOpen(true)} />
                                    <CircleIconButton icon="/img/icons.svg#icon-user" label="My account" brand="account" to="/account" />
                                    {session.user && (
                                        <CircleIconButton icon="/img/icons.svg#icon-sign-out" label="Sign out" brand="signout" onClick={() => supabase.auth.signOut()} />
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <Outlet context={{ openCart: () => setCartOpen(true) }} />

            <footer className="footer spad" id="contact-info">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-3 col-md-6 col-sm-6">
                            <div className="footer__about">
                                <div className="footer__about__logo">
                                    <Link to="/"><h3 style={{ color: '#2D6A4F', fontWeight: 700 }}>Millad&apos;s Supermarket</h3></Link>
                                </div>
                                <ul>
                                    <li>Address: 460 Notre Dame Ave, Winnipeg, MB</li>
                                    <li>Phone: +1 204-947-9558</li>
                                    <li>Email: milladssupermarket@gmail.com</li>
                                </ul>
                            </div>
                        </div>
                        <div className="col-lg-4 col-md-6 col-sm-6 offset-lg-1">
                            <div className="footer__widget footer__widget--hours">
                                <h6>Store Hours</h6>
                                <div className="footer__hours-grid">
                                    <ul className="footer__hours-list">
                                        <li><span className="footer__info-line">Mon - Sat: 9:00 AM - 8:00 PM</span></li>
                                        <li><span className="footer__info-line">Sunday: 10:00 AM - 6:00 PM</span></li>
                                    </ul>
                                    <ul className="footer__hours-list">
                                        <li><span className="footer__info-line">Pickup Available</span></li>
                                        <li><span className="footer__info-line">Orders ready in 2-4 hours</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4 col-md-12">
                            <div className="footer__widget">
                                <h6>About Us</h6>
                                <p>Millad&apos;s Supermarket offers quality halal meat, fresh groceries, and essential pantry items. Serving Winnipeg with the finest products.</p>
                                <div className="footer__widget__social">
                                    <SocialLinks />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-lg-12">
                            <div className="footer__copyright">
                                <div className="footer__copyright__text"><p>Copyright &copy; {new Date().getFullYear()} Millad&apos;s Supermarket. All rights reserved.</p></div>
                                <div className="footer__copyright__links">
                                    <Link to="/privacy">Privacy Policy</Link>
                                    <span className="footer__copyright__sep">&middot;</span>
                                    <Link to="/terms">Terms &amp; Conditions</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>

            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        </>
    );
}
