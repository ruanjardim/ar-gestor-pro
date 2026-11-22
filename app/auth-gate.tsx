'use client';

import { type SyntheticEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import GestorApp, { type CurrentUser } from './gestor-app';

type AuthMode = 'login' | 'app';

export default function AuthGate({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => await response.json() as { user?: CurrentUser | null })
      .then((result) => {
        const authenticatedUser = result.user ?? null;
        setUser(authenticatedUser);
        if (mode === 'login' && authenticatedUser) router.replace('/dashboard');
        if (mode === 'app' && !authenticatedUser) router.replace('/login');
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError('Não foi possível verificar seu acesso. Tente novamente.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [mode, router]);

  const login = async (event: SyntheticEvent<HTMLFormElement>) => {
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
      router.replace('/dashboard');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setUser(null);
    router.replace('/login');
    router.refresh();
  };

  if ((mode === 'app' && (loading || (!user && !error))) || (mode === 'login' && user)) {
    return <main className="auth-loading"><span className="auth-brand-mark">AR</span><LoaderCircle className="spin" /><p>Preparando seu ambiente...</p></main>;
  }

  if (mode === 'app' && user) return <GestorApp currentUser={user} onLogout={logout} />;

  if (mode === 'app') {
    return <main className="auth-loading"><LockKeyhole /><h1>Acesso não confirmado</h1><p>{error}</p><Link className="auth-back-link" href="/login">Voltar para o login</Link></main>;
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Apresentação do AR Gestor Pro">
        <Link className="auth-brand" href="/"><span className="auth-brand-mark">AR</span><span><strong>AR GESTOR PRO</strong><small>Gestão empresarial</small></span></Link>
        <div className="auth-story-copy">
          <span className="auth-kicker"><ShieldCheck /> Ambiente seguro e individual</span>
          <h1>Sua operação começa com uma visão mais clara.</h1>
          <p>Acesse clientes, vencimentos, cobranças e indicadores no ambiente privado da sua empresa.</p>
          <ul>
            <li><Check /> Dados separados por organização</li>
            <li><Check /> Acesso controlado por perfil</li>
            <li><Check /> Experiência responsiva e profissional</li>
          </ul>
        </div>
        <div className="auth-insight-card">
          <span><BarChart3 /></span><div><strong>Decisões com contexto</strong><small>Indicadores reais da sua operação, sem alterar suas regras.</small></div>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-theme"><ThemeToggle showLabel={false} /></div>
        <div className="auth-form-card">
          <span className="auth-lock"><LockKeyhole /></span>
          <h2>Bem-vindo de volta</h2>
          <p>Entre com a sua conta individual para continuar.</p>
          <form className="auth-form" onSubmit={login}>
            <label htmlFor="login-email"><span>E-mail</span><Input id="login-email" name="email" type="email" inputMode="email" autoComplete="username" required placeholder="voce@empresa.com" /></label>
            <label htmlFor="login-password"><span>Senha</span><span className="auth-password"><Input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Digite sua senha" /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <Button className="auth-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" /> : <KeyRound />}{submitting ? 'Entrando...' : 'Entrar com segurança'}</Button>
          </form>
          <small className="auth-help">O acesso é liberado por um administrador da sua empresa.</small>
          <Link className="auth-home-link" href="/">Voltar para o site institucional</Link>
        </div>
      </section>
    </main>
  );
}
