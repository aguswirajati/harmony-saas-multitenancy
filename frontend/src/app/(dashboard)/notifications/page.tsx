'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, Settings, Filter, CreditCard, Users, Building, BarChart3, Shield, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useDeleteAllRead,
  useNotificationPreferences,
  useUpdatePreference,
  useResetPreferences,
  formatNotificationTime,
} from '@/hooks/use-notifications';
import { getCategoryFromType, NOTIFICATION_CATEGORIES, Notification } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

function getNotificationIcon(type: string) {
  const category = getCategoryFromType(type);
  switch (category) {
    case 'billing':
      return <CreditCard className="h-5 w-5" />;
    case 'user':
      return <Users className="h-5 w-5" />;
    case 'tenant':
      return <Building className="h-5 w-5" />;
    case 'usage':
      return <BarChart3 className="h-5 w-5" />;
    case 'security':
      return <Shield className="h-5 w-5" />;
    case 'system':
      return <Megaphone className="h-5 w-5" />;
    default:
      return <Bell className="h-5 w-5" />;
  }
}

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const actionUrl = notification.data?.action_url as string | undefined;
  const category = getCategoryFromType(notification.type);

  return (
    <Card className={cn(
      'transition-colors',
      !notification.is_read && 'border-l-4 border-l-blue-500 bg-accent/30'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex-shrink-0 p-2.5 rounded-full',
            notification.priority === 'urgent' && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
            notification.priority === 'high' && 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
            notification.priority === 'normal' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
            notification.priority === 'low' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
          )}>
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className={cn(
                  'text-sm font-medium',
                  !notification.is_read && 'font-semibold'
                )}>
                  {notification.title}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {notification.message}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!notification.is_read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onMarkRead(notification.id)}
                  >
                    <Check className="h-4 w-4" />
                    <span className="sr-only">Mark as read</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(notification.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {NOTIFICATION_CATEGORIES[category as keyof typeof NOTIFICATION_CATEGORIES]?.name || category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatNotificationTime(notification.created_at)}
              </span>
              {actionUrl && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => onNavigate(actionUrl)}
                >
                  View details
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useNotifications({
    page,
    page_size: 20,
    unread_only: filter === 'unread',
  });

  const { data: countData } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();
  const deleteAllRead = useDeleteAllRead();

  const notifications = data?.notifications || [];
  const unreadCount = countData?.unread_count || 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread ({unreadCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteAllRead.mutate()}
            disabled={deleteAllRead.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear read
          </Button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'unread' ? 'You have no unread notifications' : 'You have no notifications yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markAsRead.mutate([id])}
              onDelete={(id) => deleteNotification.mutate(id)}
              onNavigate={(url) => router.push(url)}
            />
          ))}
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            disabled={page === data.total_pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationPreferences() {
  const { data, isLoading } = useNotificationPreferences();
  const updatePreference = useUpdatePreference();
  const resetPreferences = useResetPreferences();

  const categories = Object.entries(NOTIFICATION_CATEGORIES);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Notification Preferences</h3>
          <p className="text-sm text-muted-foreground">
            Choose how you want to receive notifications
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => resetPreferences.mutate()}
          disabled={resetPreferences.isPending}
        >
          Reset to defaults
        </Button>
      </div>

      <div className="space-y-4">
        {categories.map(([key, category]) => {
          const pref = data?.preferences.find((p) => p.notification_type === key);

          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{category.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`${key}-in-app`}
                        checked={pref?.in_app_enabled ?? true}
                        onCheckedChange={(checked) =>
                          updatePreference.mutate({
                            notificationType: key,
                            updates: { in_app_enabled: checked },
                          })
                        }
                      />
                      <Label htmlFor={`${key}-in-app`} className="text-sm">
                        In-app
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`${key}-email`}
                        checked={pref?.email_enabled ?? true}
                        onCheckedChange={(checked) =>
                          updatePreference.mutate({
                            notificationType: key,
                            updates: { email_enabled: checked },
                          })
                        }
                      />
                      <Label htmlFor={`${key}-email`} className="text-sm">
                        Email
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">
          View and manage your notifications
        </p>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings className="h-4 w-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <NotificationList />
        </TabsContent>

        <TabsContent value="preferences">
          <NotificationPreferences />
        </TabsContent>
      </Tabs>
    </div>
  );
}
