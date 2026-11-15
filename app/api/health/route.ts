import { ensureClientDevicesSchema, ensureClientPhonesSchema, ensureFinancialPlanningSchema } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [clientDevicesReady, clientPhonesReady, financialPlanningReady] = await Promise.all([
    ensureClientDevicesSchema(),
    ensureClientPhonesSchema(),
    ensureFinancialPlanningSchema(),
  ]);
  const ready = clientDevicesReady && clientPhonesReady && financialPlanningReady;
  return Response.json({
    status: ready ? 'ok' : 'degraded',
    release: 'multi-phone-financial-planning',
    checks: {
      clientDevices: clientDevicesReady,
      clientPhones: clientPhonesReady,
      financialPlanning: financialPlanningReady,
    },
  }, { status: ready ? 200 : 503 });
}
