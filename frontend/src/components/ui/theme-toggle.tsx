'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Subscribe to nothing, we just need this for hydration
const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  // useSyncExternalStore is the recommended way to handle hydration mismatch
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client: always true
    () => false  // Server: always false
  );

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={className} disabled>
        <Sun size={18} />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
