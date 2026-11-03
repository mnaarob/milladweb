import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAC2jgZJeH_O9-7Xl';

type TurnstileApi = {
    render: (el: HTMLElement, options: Record<string, unknown>) => string;
    reset: (id: string) => void;
    remove: (id: string) => void;
    getResponse: (id: string) => string;
};

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

export type TurnstileHandle = {
    getToken: () => string;
    reset: () => void;
};

export const TurnstileWidget = forwardRef<TurnstileHandle>(function TurnstileWidget(_, ref) {
    const host = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
        getToken() {
            if (!window.turnstile || widgetId.current == null) return '';
            return window.turnstile.getResponse(widgetId.current) || '';
        },
        reset() {
            if (window.turnstile && widgetId.current != null) window.turnstile.reset(widgetId.current);
        },
    }));

    useEffect(() => {
        let cancelled = false;
        let timer = 0;

        function mount() {
            if (cancelled || !host.current || !window.turnstile || widgetId.current != null) return Boolean(widgetId.current);
            widgetId.current = window.turnstile.render(host.current, {
                sitekey: SITE_KEY,
                theme: 'light',
            });
            return true;
        }

        if (!mount()) {
            timer = window.setInterval(() => {
                if (mount()) window.clearInterval(timer);
            }, 150);
        }

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            if (window.turnstile && widgetId.current != null) window.turnstile.remove(widgetId.current);
            widgetId.current = null;
        };
    }, []);

    return <div className="auth-captcha" ref={host} />;
});
