import { and, desc, eq, like } from 'drizzle-orm';
import { getDb } from '@/db';
import { clients, messageLogs, organizations, settings, whatsappConnections } from '@/db/schema';
import { decryptCredentials, encryptCredentials } from '@/lib/credentials';

export type MessageKind = 'due' | 'late' | 'renew' | 'test';
export type ProviderConfig = {
  provider: 'meta' | 'evolution';
  displayPhone: string;
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  templateName?: string;
  templateLanguage?: string;
  baseUrl?: string;
  instanceName?: string;
  apiKey?: string;
};

const META_GRAPH_VERSION = 'v25.0';

const defaultMessages = {
  due: 'Olá {nome}, lembramos que sua cobrança vence em {vencimento}, no valor de {valor}.\n\nPIX: {pix_chave}\nRecebedor: {pix_recebedor}\nBanco: {pix_banco}\nConta: {pix_conta}',
  late: 'Olá {nome}, sua cobrança venceu em {vencimento}, no valor de {valor}.\n\nPIX: {pix_chave}\nRecebedor: {pix_recebedor}\nBanco: {pix_banco}\nConta: {pix_conta}',
  renew: 'Olá {nome}, sua renovação foi registrada. Novo vencimento: {vencimento}. Valor: {valor}.\n\nPIX: {pix_chave}\nRecebedor: {pix_recebedor}',
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const dateBr = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
export const normalizePhone = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 15) throw new Error('Telefone inválido. Informe DDD e número do WhatsApp.');
  return digits;
};

function safeBaseUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const privateHost = host === 'localhost' || host.endsWith('.local') || host === '::1' ||
    /^(0|10|127|169\.254|192\.168)\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (url.protocol !== 'https:' || url.username || url.password || privateHost) {
    throw new Error('Use uma URL HTTPS pública para a Evolution API.');
  }
  return url.toString().replace(/\/$/, '');
}

export async function getOrganizationSettings(organizationId: number) {
  const rows = await getDb().select().from(settings).where(like(settings.key, `${organizationId}:%`));
  return Object.fromEntries(rows.map((row) => [row.key.slice(row.key.indexOf(':') + 1), row.value]));
}

export function renderBillingMessage(
  kind: Exclude<MessageKind, 'test'>,
  client: { name: string; dueDate: string; amount: number },
  organizationName: string,
  values: Record<string, string>,
) {
  const key = kind === 'due' ? 'dueMessage' : kind === 'late' ? 'lateMessage' : 'renewMessage';
  const replacements: Record<string, string> = {
    nome: client.name,
    valor: money(client.amount),
    vencimento: dateBr(client.dueDate),
    empresa: organizationName,
    pix_chave: values.pixKey || 'não informado',
    pix_tipo: values.pixType || '',
    pix_recebedor: values.pixName || 'não informado',
    pix_banco: values.pixBank || '',
    pix_conta: values.pixAccount || '',
  };
  let message = values[key] || defaultMessages[kind];
  if (values.includePix === 'false') message = message.split('\n').filter((line) => !/\{pix_(chave|tipo|recebedor|banco|conta)\}/.test(line)).join('\n');
  for (const [name, replacement] of Object.entries(replacements)) message = message.replaceAll(`{${name}}`, replacement);
  return message.split('\n').filter((line) => !/^\s*(PIX|Recebedor|Banco|Conta):\s*$/.test(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function providerRequest(connection: typeof whatsappConnections.$inferSelect, phone: string, message: string, templateValues?: string[]) {
  const secrets = await decryptCredentials(connection.secretData);
  if (connection.provider === 'meta') {
    const phoneNumberId = secrets.phoneNumberId;
    const accessToken = secrets.accessToken;
    if (!phoneNumberId || !accessToken) throw new Error('Complete o Phone Number ID e o token da Meta.');
    const templateName = secrets.templateName?.trim();
    const payload = templateName && templateValues ? {
      messaging_product: 'whatsapp', to: phone, type: 'template',
      template: {
        name: templateName,
        language: { code: secrets.templateLanguage || 'pt_BR' },
        components: [{ type: 'body', parameters: (templateValues ?? []).map((text) => ({ type: 'text', text })) }],
      },
    } : { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'text', text: { preview_url: false, body: message } };
    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } };
    if (!response.ok) throw new Error(result.error?.message || `A Meta recusou o envio (${response.status}).`);
    return result.messages?.[0]?.id || '';
  }
  const baseUrl = safeBaseUrl(secrets.baseUrl || '');
  if (!secrets.instanceName || !secrets.apiKey) throw new Error('Complete a instância e a chave da Evolution API.');
  const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(secrets.instanceName)}`, {
    method: 'POST', headers: { apikey: secrets.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ number: phone, text: message }), signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => ({})) as { key?: { id?: string }; message?: string; error?: string };
  if (!response.ok) throw new Error(result.message || result.error || `A Evolution API recusou o envio (${response.status}).`);
  return result.key?.id || '';
}

async function validateMetaConnection(secrets: Record<string, string>) {
  const phoneNumberId = secrets.phoneNumberId?.trim();
  const businessAccountId = secrets.businessAccountId?.trim();
  const accessToken = secrets.accessToken;
  const templateName = secrets.templateName?.trim();
  if (!phoneNumberId || !businessAccountId || !accessToken || !templateName) {
    throw new Error('Informe o token, o Phone Number ID, o WhatsApp Business Account ID e o modelo da Meta.');
  }

  const headers = { authorization: `Bearer ${accessToken}` };
  const [phoneResponse, templatesResponse] = await Promise.all([
    fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`, {
      headers, signal: AbortSignal.timeout(15_000),
    }),
    fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(businessAccountId)}/message_templates?fields=name,status,language,category&name=${encodeURIComponent(templateName)}&limit=20`, {
      headers, signal: AbortSignal.timeout(15_000),
    }),
  ]);
  const phoneResult = await phoneResponse.json() as { display_phone_number?: string; verified_name?: string; error?: { message?: string } };
  if (!phoneResponse.ok) throw new Error(phoneResult.error?.message || `Falha ao consultar o número na Meta (${phoneResponse.status}).`);
  const templatesResult = await templatesResponse.json() as {
    data?: Array<{ name?: string; status?: string; language?: string; category?: string }>;
    error?: { message?: string };
  };
  if (!templatesResponse.ok) throw new Error(templatesResult.error?.message || `Falha ao consultar os modelos na Meta (${templatesResponse.status}).`);
  const language = secrets.templateLanguage || 'pt_BR';
  const template = templatesResult.data?.find((item) => item.name === templateName && item.language === language);
  if (!template) throw new Error(`O modelo ${templateName} (${language}) não foi encontrado na conta da Meta.`);
  if (template.status !== 'APPROVED') throw new Error(`O modelo ${templateName} ainda não está aprovado pela Meta (status: ${template.status || 'desconhecido'}).`);
  if (template.category !== 'UTILITY') throw new Error(`O modelo ${templateName} precisa ser da categoria Utilidade para evitar cobranças de Marketing.`);
  return {
    displayPhone: phoneResult.display_phone_number || '',
    verifiedName: phoneResult.verified_name || '',
  };
}

async function insertLog(values: typeof messageLogs.$inferInsert) {
  await getDb().insert(messageLogs).values(values);
}

export async function sendClientBillingMessage(organizationId: number, clientId: number, kind: Exclude<MessageKind, 'test'>, scheduledFor?: string) {
  const db = getDb();
  const [clientRows, orgRows, connectionRows] = await Promise.all([
    db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId))).limit(1),
    db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1),
    db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, organizationId)).limit(1),
  ]);
  const client = clientRows[0];
  const organization = orgRows[0];
  const connection = connectionRows[0];
  if (!client || !organization) throw new Error('Cliente ou empresa não encontrado.');
  const phone = normalizePhone(client.phone);
  const values = await getOrganizationSettings(organizationId);
  const message = renderBillingMessage(kind, client, organization.name, values);
  const now = new Date().toISOString();
  if (!connection) {
    await insertLog({ organizationId, clientId, kind, status: 'failed', recipient: phone, messagePreview: message.slice(0, 500), error: 'WhatsApp não configurado.', scheduledFor, createdAt: now });
    throw new Error('Configure o WhatsApp antes de enviar cobranças.');
  }
  try {
    const templateValues = [client.name, money(client.amount), dateBr(client.dueDate), values.pixKey || '', values.pixName || ''];
    const providerMessageId = await providerRequest(connection, phone, message, templateValues);
    await insertLog({ organizationId, clientId, kind, status: 'sent', recipient: phone, messagePreview: message.slice(0, 500), providerMessageId, scheduledFor, createdAt: now });
    return { ok: true, message, providerMessageId };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Falha desconhecida no envio.';
    await insertLog({ organizationId, clientId, kind, status: 'failed', recipient: phone, messagePreview: message.slice(0, 500), error: detail.slice(0, 500), scheduledFor, createdAt: now });
    throw error;
  }
}

export async function sendTestMessage(organizationId: number, phoneValue: string, message: string) {
  const db = getDb();
  const connectionRows = await db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, organizationId)).limit(1);
  const connection = connectionRows[0];
  if (!connection) throw new Error('Configure o WhatsApp antes de enviar o teste.');
  const phone = normalizePhone(phoneValue);
  const now = new Date().toISOString();
  try {
    const providerMessageId = await providerRequest(connection, phone, message);
    await insertLog({ organizationId, kind: 'test', status: 'sent', recipient: phone, messagePreview: message.slice(0, 500), providerMessageId, createdAt: now });
    return { ok: true, providerMessageId };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Falha desconhecida no envio.';
    await insertLog({ organizationId, kind: 'test', status: 'failed', recipient: phone, messagePreview: message.slice(0, 500), error: detail.slice(0, 500), createdAt: now });
    throw error;
  }
}

export async function saveConnection(organizationId: number, config: ProviderConfig) {
  const db = getDb();
  const currentRows = await db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, organizationId)).limit(1);
  let previous: Record<string, string> = {};
  if (currentRows[0]) previous = await decryptCredentials(currentRows[0].secretData).catch(() => ({}));
  const secrets: Record<string, string> = config.provider === 'meta' ? {
    accessToken: config.accessToken || previous.accessToken || '',
    phoneNumberId: config.phoneNumberId || previous.phoneNumberId || '',
    businessAccountId: config.businessAccountId || previous.businessAccountId || '',
    templateName: config.templateName || '',
    templateLanguage: config.templateLanguage || 'pt_BR',
  } : {
    baseUrl: safeBaseUrl(config.baseUrl || previous.baseUrl || ''),
    instanceName: config.instanceName || previous.instanceName || '',
    apiKey: config.apiKey || previous.apiKey || '',
  };
  let metaVerification: { displayPhone: string; verifiedName: string } | null = null;
  if (config.provider === 'meta') metaVerification = await validateMetaConnection(secrets);
  if (config.provider === 'evolution' && (!secrets.baseUrl || !secrets.instanceName || !secrets.apiKey)) throw new Error('Informe URL, instância e chave da Evolution API.');
  const secretData = await encryptCredentials(secrets);
  const values = {
    provider: config.provider,
    displayPhone: metaVerification?.displayPhone || config.displayPhone.trim(),
    secretData,
    status: metaVerification ? 'connected' : 'configured',
    verifiedName: metaVerification?.verifiedName || '',
    lastCheckedAt: metaVerification ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };
  await db.insert(whatsappConnections).values({ organizationId, ...values })
    .onConflictDoUpdate({ target: whatsappConnections.organizationId, set: values });
}

export async function testConnection(organizationId: number) {
  const db = getDb();
  const rows = await db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, organizationId)).limit(1);
  const connection = rows[0];
  if (!connection) throw new Error('Configure o WhatsApp primeiro.');
  const secrets = await decryptCredentials(connection.secretData);
  try {
    let verifiedName = '';
    let displayPhone = connection.displayPhone;
    if (connection.provider === 'meta') {
      const result = await validateMetaConnection(secrets);
      verifiedName = result.verifiedName;
      displayPhone = result.displayPhone || displayPhone;
    } else {
      const response = await fetch(`${safeBaseUrl(secrets.baseUrl || '')}/instance/connectionState/${encodeURIComponent(secrets.instanceName || '')}`, { headers: { apikey: secrets.apiKey || '' }, signal: AbortSignal.timeout(15_000) });
      const result = await response.json().catch(() => ({})) as { instance?: { state?: string }; state?: string; message?: string };
      if (!response.ok) throw new Error(result.message || `Falha ao consultar a Evolution API (${response.status}).`);
      const state = result.instance?.state || result.state || '';
      if (!['open', 'connected'].includes(state.toLowerCase())) throw new Error(`A instância está ${state || 'desconectada'}.`);
      verifiedName = secrets.instanceName || '';
    }
    await db.update(whatsappConnections).set({ status: 'connected', verifiedName, displayPhone, lastCheckedAt: new Date().toISOString() }).where(eq(whatsappConnections.organizationId, organizationId));
    return { ok: true, verifiedName, displayPhone };
  } catch (error) {
    await db.update(whatsappConnections).set({ status: 'disconnected', lastCheckedAt: new Date().toISOString() }).where(eq(whatsappConnections.organizationId, organizationId));
    throw error;
  }
}

export async function getEvolutionQrCode(organizationId: number) {
  const db = getDb();
  const rows = await db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, organizationId)).limit(1);
  const connection = rows[0];
  if (!connection || connection.provider !== 'evolution') throw new Error('Configure uma conexão Evolution primeiro.');
  const secrets = await decryptCredentials(connection.secretData);
  const response = await fetch(`${safeBaseUrl(secrets.baseUrl || '')}/instance/connect/${encodeURIComponent(secrets.instanceName || '')}`, {
    headers: { apikey: secrets.apiKey || '' }, signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => ({})) as { base64?: string; qrcode?: { base64?: string }; message?: string };
  if (!response.ok) throw new Error(result.message || `Não foi possível obter o QR Code (${response.status}).`);
  let qrCode = result.base64 || result.qrcode?.base64 || '';
  if (!qrCode) throw new Error('A Evolution não retornou um QR Code. A instância pode já estar conectada.');
  if (!qrCode.startsWith('data:image/')) qrCode = `data:image/png;base64,${qrCode}`;
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(qrCode) || qrCode.length > 2_000_000) throw new Error('A Evolution retornou um QR Code inválido.');
  return qrCode;
}

export async function getWhatsappSummary(organizationId: number) {
  const db = getDb();
  const [connections, logs] = await Promise.all([
    db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, organizationId)).limit(1),
    db.select().from(messageLogs).where(eq(messageLogs.organizationId, organizationId)).orderBy(desc(messageLogs.createdAt)).limit(60),
  ]);
  const connection = connections[0];
  let publicConfig: Record<string, string> = {};
  if (connection) {
    const secret: Record<string, string> = await decryptCredentials(connection.secretData).catch(() => ({}));
    publicConfig = connection.provider === 'meta' ? {
      phoneNumberId: secret.phoneNumberId || '', businessAccountId: secret.businessAccountId || '',
      templateName: secret.templateName || '', templateLanguage: secret.templateLanguage || 'pt_BR',
    } : { baseUrl: secret.baseUrl || '', instanceName: secret.instanceName || '' };
  }
  return {
    connection: connection ? {
      provider: connection.provider, displayPhone: connection.displayPhone, status: connection.status,
      verifiedName: connection.verifiedName, lastCheckedAt: connection.lastCheckedAt, hasSecret: true, ...publicConfig,
    } : null,
    logs,
  };
}
