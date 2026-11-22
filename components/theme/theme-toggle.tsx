'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from './theme-provider';

export function ThemeToggle({ showLabel = true }: { showLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? 'lg' : 'icon-lg'}
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
      {showLabel && <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>}
    </Button>
  );
}
