import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function encryptionKey() {
  const secret = String((env as unknown as Record<string, unknown>).CREDENTIALS_KEY ?? '');
  if (secret.length < 32) throw new Error('A chave segura do WhatsApp ainda não foi configurada no servidor.');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptCredentials(value: Record<string, string>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encoder.encode(JSON.stringify(value)));
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptCredentials(value: string): Promise<Record<string, string>> {
  const [version, ivText, encryptedText] = value.split('.');
  if (version !== 'v1' || !ivText || !encryptedText) throw new Error('Credencial do WhatsApp inválida. Salve a conexão novamente.');
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivText) as BufferSource },
    await encryptionKey(),
    fromBase64(encryptedText) as BufferSource,
  );
  return JSON.parse(decoder.decode(decrypted)) as Record<string, string>;
}
