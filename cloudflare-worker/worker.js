/* =====================================================================
   Think Through Technology — Cashfree Payment Link Worker (Cloudflare)
   ---------------------------------------------------------------------
   Routes
     POST /api/create-link        → creates a Cashfree payment link
     GET  /api/link-status?id=... → fetches link status
   Every request needs header  X-Admin-Key: <ADMIN_PASSWORD>

   Settings → Variables and Secrets (Cloudflare dashboard):
     CASHFREE_APP_ID      (Secret)
     CASHFREE_SECRET_KEY  (Secret)
     ADMIN_PASSWORD       (Secret)
     CASHFREE_ENV         (Text)  sandbox | production
     ALLOWED_ORIGIN       (Text)  https://thinkthroughtechnology.in
     RETURN_URL           (Text, optional) https://thinkthroughtechnology.in/payment-status.html
   No secrets are stored in this file or on the website.
   ===================================================================== */

const API_VERSION = '2023-08-01';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    try {
      if (!(await isAdmin(request, env))) return json({ error: 'Wrong admin password' }, 401);
      if (!env.CASHFREE_APP_ID || !env.CASHFREE_SECRET_KEY) {
        return json({ error: 'Cashfree keys are not configured on the worker' }, 500);
      }

      if (url.pathname === '/api/create-link' && request.method === 'POST') {
        return await createLink(request, env, json);
      }
      if (url.pathname === '/api/link-status' && request.method === 'GET') {
        return await linkStatus(url, env, json);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: 'Server error: ' + (err && err.message ? err.message : 'unknown') }, 500);
    }
  }
};

/* ---------------- Handlers ---------------- */

async function createLink(request, env, json) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').replace(/\D/g, '').slice(-10);
  const email = String(b.email || '').trim();
  const amount = Math.round(Number(b.amount) * 100) / 100;
  const purpose = String(b.purpose || '').trim();
  const invoiceNo = String(b.invoiceNo || '').trim();
  const expiryDays = Math.min(Math.max(parseInt(b.expiryDays, 10) || 7, 1), 90);

  if (!name) return json({ error: 'Customer name is required' }, 400);
  if (!/^[6-9]\d{9}$/.test(phone)) return json({ error: 'Enter a valid 10-digit Indian mobile number' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Email looks invalid' }, 400);
  if (!(amount >= 1)) return json({ error: 'Amount must be at least ₹1' }, 400);
  if (!purpose) return json({ error: 'Purpose is required' }, 400);

  const istNow = new Date(Date.now() + 5.5 * 3600000);
  const stamp = istNow.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 6).toUpperCase();
  const linkId = `TTT_${stamp}_${rand}`;
  const expiry = new Date(istNow.getTime() + expiryDays * 86400000).toISOString().slice(0, 10) + 'T23:59:59+05:30';

  const payload = {
    link_id: linkId,
    link_amount: amount,
    link_currency: 'INR',
    link_purpose: (invoiceNo ? `${purpose} (Ref: ${invoiceNo})` : purpose).slice(0, 500),
    customer_details: {
      customer_name: name,
      customer_phone: phone,
      ...(email ? { customer_email: email } : {})
    },
    link_expiry_time: expiry,
    link_notify: { send_sms: !!b.sendSms, send_email: !!b.sendEmail && !!email },
    link_auto_reminders: true,
    link_notes: { invoice_no: invoiceNo || '-', created_by: 'ttt-admin' },
    link_meta: { return_url: env.RETURN_URL || 'https://thinkthroughtechnology.in/payment-status.html' }
  };
  if (b.partial) {
    const min = Math.round(Number(b.minPartial) * 100) / 100;
    payload.link_partial_payments = true;
    if (min >= 1 && min < amount) payload.link_minimum_partial_amount = min;
  }

  const r = await cashfree(env, '/links', { method: 'POST', body: JSON.stringify(payload) });
  if (!r.ok) return json({ error: r.data.message || 'Cashfree rejected the request', details: r.data }, r.status || 502);

  return json({
    linkId: r.data.link_id,
    linkUrl: r.data.link_url,
    status: r.data.link_status,
    amount: r.data.link_amount,
    expiry: r.data.link_expiry_time
  });
}

async function linkStatus(url, env, json) {
  const id = url.searchParams.get('id') || '';
  if (!/^[A-Za-z0-9_-]{3,50}$/.test(id)) return json({ error: 'Invalid link id' }, 400);
  const r = await cashfree(env, '/links/' + encodeURIComponent(id), { method: 'GET' });
  if (!r.ok) return json({ error: r.data.message || 'Could not fetch link' }, r.status || 502);
  return json({
    linkId: r.data.link_id,
    status: r.data.link_status,           // ACTIVE | PAID | PARTIALLY_PAID | EXPIRED | CANCELLED
    amount: r.data.link_amount,
    amountPaid: r.data.link_amount_paid,
    linkUrl: r.data.link_url
  });
}

/* ---------------- Helpers ---------------- */

async function cashfree(env, path, options) {
  const base = String(env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
  const r = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': API_VERSION,
      'x-client-id': env.CASHFREE_APP_ID,
      'x-client-secret': env.CASHFREE_SECRET_KEY
    }
  });
  let data = {};
  try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}

function corsHeaders(request, env) {
  const allowed = String(env.ALLOWED_ORIGIN || 'https://thinkthroughtechnology.in').split(',').map(s => s.trim());
  const origin = request.headers.get('Origin');
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Vary': 'Origin'
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

// Constant-time password check (compares SHA-256 digests byte by byte)
async function isAdmin(request, env) {
  const expected = env.ADMIN_PASSWORD || '';
  const given = request.headers.get('X-Admin-Key') || '';
  if (!expected || !given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
    crypto.subtle.digest('SHA-256', enc.encode(given))
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
