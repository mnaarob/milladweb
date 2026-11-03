import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

type SessionValue = {
    user: User | null;
    token: string | null;
    loading: boolean;
    isStaff: boolean;
    staffReady: boolean;
    staffError: string;
};

const SessionContext = createContext<SessionValue>({ user: null, token: null, loading: true, isStaff: false, staffReady: false, staffError: '' });

export function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isStaff, setIsStaff] = useState(false);
    const [staffReady, setStaffReady] = useState(false);
    const [staffError, setStaffError] = useState('');

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLoading(false);
        });
        const { data } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next);
        });
        return () => data.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!session?.access_token) {
            setIsStaff(false);
            setStaffError('');
            setStaffReady(true);
            return;
        }
        setStaffReady(false);
        let cancelled = false;
        api<unknown[]>('/api/admin/products', { token: session.access_token })
            .then(() => {
                if (cancelled) return;
                setIsStaff(true);
                setStaffError('');
                setStaffReady(true);
            })
            .catch((err: Error) => {
                if (cancelled) return;
                setIsStaff(false);
                setStaffError(err.message || '');
                setStaffReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [session?.access_token]);

    return (
        <SessionContext.Provider value={{ user: session?.user ?? null, token: session?.access_token ?? null, loading, isStaff, staffReady, staffError }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    return useContext(SessionContext);
}
