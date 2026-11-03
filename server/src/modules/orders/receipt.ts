type MailItem = { name: string; quantity: number; price: number; notes?: string; unit?: string; cancelled?: boolean };

type MailPricing = { subtotal: number; gst: number; pst: number; deliveryFee?: number; total: number };

const GREEN = '#2D6A4F';
const GREEN_DARK = '#1B4332';
const INK = '#1c1c1c';
const MUTED = '#5c6b64';
const LINE = '#e3ebe6';
const SOFT = '#f4f8f6';
const PAGE = '#f3f6f4';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function esc(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(value: number) {
    return `$${value.toFixed(2)}`;
}

function phoneDigits(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
    return digits;
}

function phoneLabel(phone: string) {
    const local = phoneDigits(phone);
    if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
    return phone;
}

function phoneHref(phone: string) {
    const local = phoneDigits(phone);
    if (local.length === 10) return `tel:+1${local}`;
    const digits = phone.replace(/\D/g, '');
    return digits ? `tel:+${digits}` : '';
}

function quantityLabel(item: MailItem) {
    if (item.cancelled) return 'Cancelled';
    if (/\bkg\b/i.test(item.unit || '')) {
        const kg = Math.round(item.quantity * 1000) / 1000;
        return `${kg} kg`;
    }
    return Number.isInteger(item.quantity) ? String(item.quantity) : String(item.quantity);
}

function slotLabel(slot: '2pm' | '8pm' | undefined) {
    if (slot === '2pm') return '2:00 PM';
    if (slot === '8pm') return '8:00 PM';
    return '';
}

function documentHtml(title: string, card: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
</head>
<body bgcolor="${PAGE}" style="margin:0;padding:0;background:${PAGE};color:${INK};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE}" style="background:${PAGE};">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
        ${card}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function header(storeName: string, eyebrow: string, headline: string) {
    return `<tr>
      <td bgcolor="${GREEN}" style="background:${GREEN};padding:28px 28px 24px;">
        <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.04em;color:#d7efe4;">${esc(storeName)}</p>
        <p style="margin:14px 0 0;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#b7dccb;">${esc(eyebrow)}</p>
        <h1 style="margin:6px 0 0;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:800;color:#ffffff;">${headline}</h1>
      </td>
    </tr>`;
}

function sectionLabel(text: string) {
    return `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${GREEN};">${esc(text)}</p>`;
}

function field(label: string, valueHtml: string) {
    return `<tr>
      <td style="padding:0 0 14px;">
        <p style="margin:0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">${esc(label)}</p>
        <p style="margin:3px 0 0;font-family:${FONT};font-size:18px;line-height:1.35;font-weight:700;color:${INK};">${valueHtml}</p>
      </td>
    </tr>`;
}

function itemBlocks(items: MailItem[]) {
    return items.map((item) => {
        const cancelled = Boolean(item.cancelled);
        const nameColor = cancelled ? MUTED : INK;
        const nameStyle = cancelled ? `color:${MUTED};text-decoration:line-through;` : `color:${INK};`;
        const amount = cancelled ? '—' : money(item.price * item.quantity);
        const note = item.notes?.trim()
            ? `<p style="margin:4px 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:${MUTED};">${esc(item.notes.trim())}</p>`
            : '';
        return `<tr>
          <td style="padding:0 0 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SOFT}" style="background:${SOFT};border:1px solid ${LINE};border-radius:12px;">
              <tr>
                <td style="padding:14px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-family:${FONT};font-size:16px;line-height:1.35;font-weight:800;${nameStyle}">${esc(item.name)}${cancelled ? ' (cancelled)' : ''}</td>
                      <td align="right" valign="top" style="font-family:${FONT};font-size:16px;font-weight:800;color:${cancelled ? MUTED : GREEN};white-space:nowrap;padding-left:12px;">${amount}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top:4px;font-family:${FONT};font-size:13px;line-height:1.4;color:${nameColor};">Quantity ${esc(quantityLabel(item))}</td>
                    </tr>
                  </table>
                  ${note}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }).join('');
}

function totalRows(pricing: MailPricing, fulfillment: 'pickup' | 'delivery') {
    const lines: [string, string, boolean?][] = [
        ['Subtotal', money(pricing.subtotal)],
        ['GST (5%)', money(pricing.gst)],
        ['PST (7%)', money(pricing.pst)],
    ];
    if (fulfillment === 'delivery') lines.push(['Delivery', money(pricing.deliveryFee ?? 0)]);
    const body = lines.map(([label, value]) => `<tr>
        <td style="padding:5px 0;font-family:${FONT};font-size:14px;color:${MUTED};">${label}</td>
        <td align="right" style="padding:5px 0;font-family:${FONT};font-size:14px;color:${INK};">${value}</td>
      </tr>`).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${body}
      <tr>
        <td style="padding:12px 0 0;border-top:2px solid ${LINE};font-family:${FONT};font-size:18px;font-weight:800;color:${INK};">Total</td>
        <td align="right" style="padding:12px 0 0;border-top:2px solid ${LINE};font-family:${FONT};font-size:18px;font-weight:800;color:${GREEN};">${money(pricing.total)} CAD</td>
      </tr>
    </table>`;
}

function noteBox(text: string) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SOFT}" style="background:${SOFT};border-radius:12px;">
      <tr>
        <td style="padding:14px 16px;font-family:${FONT};font-size:14px;line-height:1.5;color:${GREEN_DARK};">${text}</td>
      </tr>
    </table>`;
}

export function orderReceiptHtml(input: {
    storeName: string;
    orderId: string;
    customerName: string;
    phone: string;
    fulfillment: 'pickup' | 'delivery';
    deliveryAddress?: string;
    deliverySlot?: '2pm' | '8pm';
    items: MailItem[];
    pricing: MailPricing;
    updated?: boolean;
}) {
    const shortId = input.orderId.slice(-6).toUpperCase();
    const slot = slotLabel(input.deliverySlot);
    const phone = phoneLabel(input.phone);
    const href = phoneHref(input.phone);
    const phoneLink = href
        ? `<a href="${href}" style="color:${GREEN_DARK};text-decoration:none;font-weight:800;">${esc(phone)}</a>`
        : esc(phone);
    const when = input.fulfillment === 'delivery'
        ? `We will call you at ${phoneLink} to go over delivery.${input.deliveryAddress ? `<br>Address: <strong>${esc(input.deliveryAddress)}</strong>` : ''}${slot ? `<br>Window: <strong>${slot}</strong>. Arrival can be about 20–30 minutes earlier or later.` : ''}`
        : `We will call you at ${phoneLink} when it is ready for pickup.`;
    const lead = input.updated
        ? `Your order has been updated. Cancelled items are marked and are not included in the total.`
        : when;
    const card = `
      ${header(input.storeName, input.updated ? 'Order updated' : 'Order received', `Thank you, ${esc(input.customerName)}`)}
      <tr>
        <td style="padding:24px 28px 8px;">
          <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">Order number</p>
          <p style="margin:4px 0 0;font-family:${FONT};font-size:26px;line-height:1.2;font-weight:800;color:${INK};">#${shortId}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 8px;">
          ${noteBox(lead)}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 0;">
          ${sectionLabel('Items')}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemBlocks(input.items)}</table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 28px;">
          ${totalRows(input.pricing, input.fulfillment)}
          <p style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">We will call you about this order. The final amount can change with the actual weight.</p>
        </td>
      </tr>
      <tr>
        <td bgcolor="${SOFT}" style="background:${SOFT};padding:18px 28px;border-top:1px solid ${LINE};font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};text-align:center;">
          ${esc(input.storeName)}<br>
          460 Notre Dame Avenue, Winnipeg, Manitoba<br>
          <a href="tel:+12049479558" style="color:${GREEN};text-decoration:none;">204-947-9558</a>
        </td>
      </tr>`;
    return documentHtml(`${input.storeName} order #${shortId}`, card);
}

export function orderAlertHtml(input: {
    storeName: string;
    orderId: string;
    customerName: string;
    phone: string;
    email?: string;
    fulfillment: 'pickup' | 'delivery';
    deliveryAddress?: string;
    deliverySlot?: '2pm' | '8pm';
    items: MailItem[];
    pricing: MailPricing;
}) {
    const shortId = input.orderId.slice(-6).toUpperCase();
    const slot = slotLabel(input.deliverySlot);
    const phone = phoneLabel(input.phone);
    const href = phoneHref(input.phone);
    const phoneValue = href
        ? `<a href="${href}" style="color:${GREEN_DARK};text-decoration:none;">${esc(phone)}</a>`
        : esc(phone);
    const emailValue = input.email
        ? `<a href="mailto:${esc(input.email)}" style="color:${GREEN_DARK};text-decoration:none;">${esc(input.email)}</a>`
        : 'No email on this order';
    const how = input.fulfillment === 'delivery' ? 'Delivery' : 'Pickup';
    const where = input.fulfillment === 'delivery'
        ? `${esc(input.deliveryAddress || 'Address not provided')}${slot ? `<br><span style="font-weight:600;color:${MUTED};">${slot} window</span>` : ''}`
        : 'Customer will pick up at the store';
    const card = `
      ${header(input.storeName, 'New order', `#${shortId}`)}
      <tr>
        <td style="padding:24px 28px 0;">
          ${sectionLabel('Customer')}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SOFT}" style="background:${SOFT};border:1px solid ${LINE};border-radius:12px;">
            <tr>
              <td style="padding:16px 16px 2px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${field('Name', esc(input.customerName))}
                  ${field('Phone', phoneValue)}
                  ${field('Email', emailValue)}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px 0;">
          ${sectionLabel(how)}
          <p style="margin:0 0 4px;font-family:${FONT};font-size:16px;line-height:1.45;font-weight:700;color:${INK};">${where}</p>
          <p style="margin:0;font-family:${FONT};font-size:14px;color:${MUTED};">Cash</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 0;">
          ${sectionLabel('Items')}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemBlocks(input.items)}</table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 28px;">
          ${totalRows(input.pricing, input.fulfillment)}
          <p style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">Call the customer to go over the order. The final amount can change with the actual weight.</p>
        </td>
      </tr>`;
    return documentHtml(`New order #${shortId}`, card);
}
