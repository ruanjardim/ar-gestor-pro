import app from './dist/server/index.js';

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'same-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    return withSecurityHeaders(await app.fetch(request, env, ctx));
  },

  async scheduled(_controller, env, ctx) {
    if (!env.AUTOMATION_SECRET) {
      console.error('AUTOMATION_SECRET não configurado; automação ignorada.');
      return;
    }
    const request = new Request('https://ar-gestor-pro.internal/api/automation', {
      method: 'POST',
      headers: { 'x-ar-automation-secret': env.AUTOMATION_SECRET },
    });
    ctx.waitUntil(app.fetch(request, env, ctx).then(async (response) => {
      if (!response.ok) console.error(`Falha na automação: ${response.status}`);
    }).catch((error) => console.error('Falha na automação agendada.', error)));
  },
};
