import { runAllAutomations } from '@/lib/automation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const expected = process.env.AUTOMATION_SECRET ?? '';
  const received = request.headers.get('x-ar-automation-secret') ?? '';
  if (!expected || received !== expected) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    return Response.json({ ok: true, results: await runAllAutomations() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Falha na automação.' }, { status: 500 });
  }
}
