import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { messageLogs } from '@/db/schema';

export const dynamic = 'force-dynamic';

const workerEnv = () => env as unknown as Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value : '';

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function hasValidSignature(body: string, signatureHeader: string, appSecret: string) {
  if (!signatureHeader.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return timingSafeEqual(signatureHeader.slice(7).toLowerCase(), bytesToHex(new Uint8Array(digest)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expectedToken = text(workerEnv().WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (!expectedToken) return new Response('Webhook não configurado.', { status: 503 });
  if (mode === 'subscribe' && token && challenge && timingSafeEqual(token, expectedToken)) {
    return new Response(challenge, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return new Response('Verificação recusada.', { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = text(workerEnv().META_APP_SECRET);
  if (!appSecret) return new Response('Assinatura do webhook não configurada.', { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256') || '';
  if (!await hasValidSignature(rawBody, signature, appSecret)) return new Response('Assinatura inválida.', { status: 401 });

  let payload: {
    object?: string;
    entry?: Array<{ changes?: Array<{ value?: { statuses?: Array<{ id?: string; status?: string; errors?: Array<{ title?: string; message?: string }> }> } }> }>;
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return new Response('JSON inválido.', { status: 400 });
  }
  if (payload.object !== 'whatsapp_business_account') return Response.json({ ok: true });

  const db = getDb();
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const status of change.value?.statuses || []) {
        const providerMessageId = text(status.id);
        if (!providerMessageId) continue;
        const state = text(status.status);
        const error = (status.errors || []).map((item) => text(item.title) || text(item.message)).filter(Boolean).join('; ');
        await db.update(messageLogs).set({ status: state || 'sent', error: error.slice(0, 500) }).where(eq(messageLogs.providerMessageId, providerMessageId));
      }
    }
  }
  return Response.json({ ok: true });
}
