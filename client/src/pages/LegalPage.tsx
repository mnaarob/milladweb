import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

function readLegal(source: string) {
    const updated = source.match(/Last updated:\s*([^<]+)/i)?.[1]?.trim() ?? '';
    const main = source.match(/<main[^>]*class="legal-body"[^>]*>([\s\S]*?)<\/main>/i)?.[1];
    if (main) {
        return {
            updated,
            html: main
                .replace(/href="\/privacy-policy(?:\.html)?"/g, 'href="/privacy"')
                .replace(/href="\/terms(?:\.html)?"/g, 'href="/terms"'),
        };
    }
    const body = source.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? source;
    return { updated, html: body };
}

export function LegalPage({ source, file, title }: { source?: string; file?: string; title: string }) {
    const [fetched, setFetched] = useState('');
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [source, file]);

    useEffect(() => {
        if (source || !file) return;
        let cancelled = false;
        setFetched('');
        setFailed(false);
        fetch(file)
            .then((response) => {
                if (!response.ok) throw new Error('missing');
                return response.text();
            })
            .then((text) => {
                if (!cancelled) setFetched(text);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [source, file]);

    const text = source ?? fetched;
    const { updated, html } = useMemo(() => readLegal(text), [text]);

    return (
        <section className="spad">
            <article className="legal-page">
                <h1>{title}</h1>
                {updated && <p className="legal-page__updated">Last updated: {updated}</p>}
                {failed || (!text && !source)
                    ? <p>{failed ? 'This page could not be loaded.' : 'Loading…'}</p>
                    : <div className="legal-page__body" dangerouslySetInnerHTML={{ __html: html }} />}
                <p className="legal-page__links">
                    <Link to="/privacy">Privacy Policy</Link>
                    <Link to="/terms">Terms &amp; Conditions</Link>
                </p>
            </article>
        </section>
    );
}
