import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { whatsappConnections } from '@/db/schema';
import { authErrorResponse, ensureSameOrigin, requireMaster, requireUser, writeAudit } from '@/lib/auth';
import { getEvolutionQrCode, getWhatsappSummary, saveConnection, sendClientBillingMessage, sendTestMessage, testConnection } from '@/lib/whatsapp';
import { runOrganizationAutomation } from '@/lib/automation';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });
const bodyText = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return json(await getWhatsappSummary(user.organizationId));
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao carregar o WhatsApp.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request);
    const body = await request.json() as Record<string, unknown>;
    const action = bodyText(body.action);
    const user = await requireUser(request);

    if (action === 'sendClient') {
      const clientId = Number(body.clientId);
      const kind = body.kind === 'late' || body.kind === 'renew' ? body.kind : 'due';
      if (!Number.isInteger(clientId)) return json({ error: 'Cliente inválido.' }, 400);
      const result = await sendClientBillingMessage(user.organizationId, clientId, kind);
      await writeAudit(user, 'send_whatsapp', 'client', clientId, kind);
      return json(result);
    }

    const master = await requireMaster(request);
    if (action === 'saveConnection') {
      const provider = body.provider === 'evolution' ? 'evolution' : 'meta';
      await saveConnection(master.organizationId, {
        provider,
        displayPhone: bodyText(body.displayPhone),
        accessToken: bodyText(body.accessToken),
        phoneNumberId: bodyText(body.phoneNumberId),
        businessAccountId: bodyText(body.businessAccountId),
        templateName: bodyText(body.templateName),
        templateLanguage: bodyText(body.templateLanguage, 'pt_BR'),
        baseUrl: bodyText(body.baseUrl),
        instanceName: bodyText(body.instanceName),
        apiKey: bodyText(body.apiKey),
      });
      await writeAudit(master, 'save_whatsapp_connection', 'whatsapp');
      return json({ ok: true });
    }
    if (action === 'testConnection') {
      const result = await testConnection(master.organizationId);
      await writeAudit(master, 'test_whatsapp_connection', 'whatsapp');
      return json(result);
    }
    if (action === 'getQr') {
      const qrCode = await getEvolutionQrCode(master.organizationId);
      await writeAudit(master, 'request_whatsapp_qr', 'whatsapp');
      return json({ ok: true, qrCode });
    }
    if (action === 'sendTest') {
      const phone = bodyText(body.phone);
      const message = bodyText(body.message).trim();
      if (!message) return json({ error: 'Digite uma mensagem de teste.' }, 400);
      const result = await sendTestMessage(master.organizationId, phone, message);
      await writeAudit(master, 'send_whatsapp_test', 'whatsapp');
      return json(result);
    }
    if (action === 'runAutomationNow') {
      const result = await runOrganizationAutomation(master.organizationId, true);
      await writeAudit(master, 'run_whatsapp_automation', 'whatsapp', null, JSON.stringify(result));
      return json({ ok: true, ...result });
    }
    if (action === 'removeConnection') {
      await getDb().delete(whatsappConnections).where(eq(whatsappConnections.organizationId, master.organizationId));
      await writeAudit(master, 'remove_whatsapp_connection', 'whatsapp');
      return json({ ok: true });
    }
    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha na integração com o WhatsApp.' }, 500);
  }
}
