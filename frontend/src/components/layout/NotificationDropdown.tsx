'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink, AlertCircle, CreditCard, Users, Building, BarChart3, Shield, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUnreadCount, useNotifications, useMarkAsRead, useMarkAllAsRead, formatNotificationTime } from '@/hooks/use-notifications';
import { getCategoryFromType, getPriorityColor, Notification } from '@/lib/api/notifications';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

interface NotificationDropdownProps {
  className?: string;
}

function getNotificationIcon(type: string) {
  const category = getCategoryFromType(type);
  switch (category) {
    case 'billing':
      return <CreditCard className="h-4 w-4" />;
    case 'user':
      return <Users className="h-4 w-4" />;
    case 'tenant':
      return <Building className="h-4 w-4" />;
    case 'usage':
      return <BarChart3 className="h-4 w-4" />;
    case 'security':
      return <Shield className="h-4 w-4" />;
    case 'system':
      return <Megaphone className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const actionUrl = notification.data?.action_url as string | undefined;

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    if (actionUrl) {
      onNavigate(actionUrl);
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 hover:bg-accent cursor-pointer transition-colors',
        !notification.is_read && 'bg-accent/50'
      )}
      onClick={handleClick}
    >
      <div className={cn(
        'flex-shrink-0 p-2 rounded-full',
        notification.priority === 'urgent' && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        notification.priority === 'high' && 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        notification.priority === 'normal' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        notification.priority === 'low' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      )}>
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm font-medium truncate',
            !notification.is_read && 'font-semibold'
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-500" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatNotificationTime(notification.created_at)}
          </span>
          {actionUrl && (
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  const { data: countData } = useUnreadCount({ enabled: isAuthenticated });
  const { data: notificationsData, isLoading } = useNotifications({
    page: 1,
    page_size: 10,
    enabled: isAuthenticated,
  });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const unreadCount = countData?.unread_count || 0;
  const notifications = notificationsData?.notifications || [];
  const hasNotifications = notifications.length > 0;

  const handleMarkRead = (id: string) => {
    markAsRead.mutate([id]);
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate();
  };

  const handleNavigate = (url: string) => {
    setIsOpen(false);
    router.push(url);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative h-9 w-9', className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium leading-none">Notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                {unreadCount > 0
                  ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                  : 'No new notifications'}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleMarkAllRead}
                disabled={markAllAsRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : hasNotifications ? (
          <>
            <ScrollArea className="h-[320px]">
              <div className="divide-y">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </ScrollArea>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => handleNavigate('/notifications')}
              >
                View all notifications
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No notifications yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              We&apos;ll notify you when something happens
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
