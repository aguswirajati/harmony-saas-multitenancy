'use client';

import { LogOut, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface UserDropdownProps {
  variant?: 'admin' | 'dashboard';
  showName?: boolean;
  className?: string;
}

export function UserDropdown({
  variant = 'dashboard',
  showName = true,
  className,
}: UserDropdownProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleProfile = () => {
    if (variant === 'admin') {
      // Admin has no profile page, just show dropdown
      return;
    }
    router.push('/profile');
  };

  const initials =
    user?.full_name?.charAt(0) || user?.email.charAt(0).toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'flex items-center gap-2 px-2 h-9',
            !showName && 'w-9 p-0',
            className
          )}
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.full_name || user?.email} />
            <AvatarFallback
              className={cn(
                'text-xs font-medium',
                variant === 'admin'
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                  : 'bg-primary text-primary-foreground'
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          {showName && (
            <>
              <span className="max-w-[100px] truncate text-sm font-medium hidden sm:inline">
                {user?.full_name || user?.email}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:inline" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.full_name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {variant === 'dashboard' && (
          <DropdownMenuItem onClick={handleProfile}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleLogout} variant="destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
