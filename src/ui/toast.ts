/** In-page toasts (used by the userscript instead of system notifications, and for small confirmations). */
let host: HTMLElement | null = null;

export function toast(text: string, ms = 4000, doc: Document = document): void {
  if (!host || !host.isConnected) {
    host = doc.createElement('div');
    host.id = 'pkbot-toasts';
    host.setAttribute(
      'style',
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483646;display:flex;flex-direction:column;gap:6px;pointer-events:none;max-width:calc(100vw - 32px);',
    );
    doc.body.appendChild(host);
  }
  const el = doc.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute(
    'style',
    'background:#1d2233;color:#f2f4fb;border:1px solid #4a5578;border-radius:8px;padding:8px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);opacity:0;transition:opacity .2s;',
  );
  el.textContent = text;
  host.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = '1'));
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, ms);
}
