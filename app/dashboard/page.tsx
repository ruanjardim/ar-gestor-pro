import type { Metadata } from 'next';
import AuthGate from '../auth-gate';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <AuthGate mode="app" />;
}
