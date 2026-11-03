const base = import.meta.env.VITE_API_URL || '';

export async function api<T>(path: string, options: RequestInit & { token?: string | null } = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
    const response = await fetch(`${base}${path}`, { ...options, headers });
    const text = await response.text();
    const data = text ? JSON.parse(text) as { error?: string } : {};
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data as T;
}
