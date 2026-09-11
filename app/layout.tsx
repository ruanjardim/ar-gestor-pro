import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AR Gestor Pro',
  description: 'Gestão privada de clientes, vencimentos e cobranças da AR Gestor Pro.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
