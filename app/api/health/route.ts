import { ensureClientDevicesSchema } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clientDevicesReady = await ensureClientDevicesSchema();
  return Response.json({
    status: clientDevicesReady ? 'ok' : 'degraded',
    release: 'client-devices-hotfix',
    checks: { clientDevices: clientDevicesReady },
  }, { status: clientDevicesReady ? 200 : 503 });
}
