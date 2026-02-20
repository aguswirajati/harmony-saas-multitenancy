'use client';

import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDevModeStore } from '@/lib/store/devModeStore';
import { adminToolsAPI } from '@/lib/api/admin-tools';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DevModeButtonProps {
  className?: string;
}

export function DevModeButton({ className }: DevModeButtonProps) {
  const { devMode, setDevMode } = useDevModeStore();

  const handleToggle = async () => {
    const newValue = !devMode;
    try {
      // Update frontend store immediately for responsive UI
      setDevMode(newValue);
      // Sync with backend to enable server-side dev features
      await adminToolsAPI.updateSettings({ dev_mode: newValue });
      toast.success(`Dev mode ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      // Revert on failure
      setDevMode(!newValue);
      toast.error('Failed to update dev mode setting');
      console.error('Dev mode toggle error:', error);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className={cn(
            'relative h-9 w-9',
            devMode && 'text-amber-500',
            className
          )}
        >
          <Bug className="h-5 w-5" />
          {devMode && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
          )}
          <span className="sr-only">Toggle dev mode</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>Dev Mode: {devMode ? 'On' : 'Off'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
