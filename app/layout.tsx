import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/theme-provider';
import './globals.css';
import './modern.css';

export const metadata: Metadata = {
  title: {
    default: 'AR Gestor Pro | Gestão empresarial simples e profissional',
    template: '%s | AR Gestor Pro',
  },
  description: 'Clientes, vencimentos, cobranças e financeiro em uma plataforma empresarial segura e organizada.',
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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ar-gestor-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.classList.toggle('theme-dark',t==='dark');r.classList.toggle('theme-light',t==='light');r.style.colorScheme=t}catch(e){document.documentElement.classList.add('dark','theme-dark')}})()`,
          }}
        />
      </head>
      <body className="antialiased"><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
