/**
 * Footer for a future commercial electronic message under Canada's Anti-Spam
 * Legislation (CASL). Order receipts and password resets are transactional and
 * must not use this footer.
 *
 * The caller has to pass a real unsubscribe URL. There is no promo list yet,
 * so nothing in the app calls this function.
 */
export function marketingEmailFooter(options: {
    unsubscribeUrl: string;
    storeName?: string;
}): string {
    const unsubscribeUrl = options.unsubscribeUrl?.trim();
    if (!unsubscribeUrl) {
        throw new Error('marketingEmailFooter requires an unsubscribeUrl');
    }

    const storeName = escapeHtml(options.storeName?.trim() || "Millad's Supermarket");
    const safeUrl = escapeHtml(unsubscribeUrl);

    return `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;color:#666;font-size:12px;line-height:1.5">
      ${storeName}<br>
      460 Notre Dame Avenue, Winnipeg, Manitoba, Canada<br>
      <a href="tel:+12049479558" style="color:#666;text-decoration:underline">+1 204-947-9558</a>
      · <a href="mailto:milladssupermarket@gmail.com" style="color:#666;text-decoration:underline">milladssupermarket@gmail.com</a>
    </p>
    <p style="margin:8px 0 0;font-size:12px;line-height:1.5">
      <a href="${safeUrl}" style="color:#2D6A4F;text-decoration:underline">Unsubscribe</a>
      from promotional emails. You can also email
      <a href="mailto:milladssupermarket@gmail.com" style="color:#2D6A4F;text-decoration:underline">milladssupermarket@gmail.com</a>.
    </p>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
