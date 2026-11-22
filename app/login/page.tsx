import type { Metadata } from 'next';
import AuthGate from '../auth-gate';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse com segurança o seu ambiente no AR Gestor Pro.',
};

export default function LoginPage() {
  return <AuthGate mode="login" />;
}
