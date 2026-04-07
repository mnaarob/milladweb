import { STRIPE_PUBLISHABLE_KEY } from '../config/supabase.js';

let stripeInstance = null;
let cardElement = null;

export function getStripe() {
    if (!stripeInstance) {
        stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
    }
    return stripeInstance;
}

export function mountCardElement(selector) {
    const stripe = getStripe();
    const elements = stripe.elements();
    cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' },
            },
        },
        hidePostalCode: true
    });

    const container = document.querySelector(selector);
    if (container) {
        cardElement.mount(selector);
    }
    return cardElement;
}

export function getCardElement() {
    return cardElement;
}

export async function createPaymentToken() {
    if (!cardElement) throw new Error('Card element not mounted');
    const stripe = getStripe();
    const { token, error } = await stripe.createToken(cardElement);
    if (error) throw error;
    return token;
}
