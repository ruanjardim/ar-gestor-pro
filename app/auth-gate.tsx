'use client';

import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GestorApp, { type CurrentUser } from './gestor-app';

export default function AuthGate() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth', { cache: 'no-store' })
      .then(async (response) => await response.json() as { user?: CurrentUser | null })
      .then((result: { user?: CurrentUser | null }) => setUser(result.user ?? null))
      .catch(() => setError('Não foi possível verificar seu acesso.'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: form.get('email'), password: form.get('password') }),
      });
      const result = await response.json() as { user?: CurrentUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error ?? 'Não foi possível entrar.');
      setUser(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setUser(null);
  };

  if (loading) return <div className="login-shell"><div className="login-loader"><LoaderCircle/><span>Carregando acesso...</span></div></div>;
  if (user) return <GestorApp currentUser={user} onLogout={logout}/>;

  return <main className="login-shell">
    <section className="login-card">
      <div className="login-brand"><div className="brand-mark">AR</div><div><strong>AR GESTOR PRO</strong><span>Ambiente da equipe</span></div></div>
      <div className="login-heading"><span><ShieldCheck/></span><h1>Entre no gestor</h1><p>Use sua conta individual para acessar os dados compartilhados da equipe.</p></div>
      <form className="login-form" onSubmit={login}>
        <label><span>E-mail</span><Input name="email" type="email" autoComplete="username" required placeholder="voce@empresa.com"/></label>
        <label><span>Senha</span><Input name="password" type="password" autoComplete="current-password" required placeholder="Sua senha"/></label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <Button type="submit" disabled={submitting}>{submitting?<LoaderCircle className="spin"/>:<KeyRound/>}{submitting?'Entrando...':'Entrar'}</Button>
      </form>
      <small>Acesso restrito às pessoas cadastradas pelos Masters.</small>
    </section>
  </main>;
}
