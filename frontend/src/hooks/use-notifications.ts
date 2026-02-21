/**
 * Notifications Hook
 * React Query hooks for notification management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications,
  getUnreadCount,
  getNotificationTypes,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  getPreferences,
  updatePreference,
  resetPreferences,
  Notification,
  NotificationListResponse,
  NotificationPreference,
} from '@/lib/api/notifications';

// Query keys
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: Record<string, unknown>) => [...notificationKeys.all, 'list', params] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  types: () => [...notificationKeys.all, 'types'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

// Polling interval for unread count (30 seconds)
const POLLING_INTERVAL = 30000;

/**
 * Hook to get paginated notifications
 */
export function useNotifications(params?: {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
  notification_type?: string;
}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => listNotifications(params),
    staleTime: 10000, // 10 seconds
  });
}

/**
 * Hook to get unread notification count with polling
 */
export function useUnreadCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadCount,
    refetchInterval: POLLING_INTERVAL,
    staleTime: 5000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to get notification types
 */
export function useNotificationTypes() {
  return useQuery({
    queryKey: notificationKeys.types(),
    queryFn: getNotificationTypes,
    staleTime: Infinity, // Types don't change
  });
}

/**
 * Hook to get notification preferences
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: getPreferences,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to mark notifications as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationIds: string[]) => markAsRead(notificationIds),
    onSuccess: () => {
      // Invalidate both list and count
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    // Optimistic update
    onMutate: async (notificationIds) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      // Update unread count optimistically
      const previousCount = queryClient.getQueryData<{ unread_count: number }>(
        notificationKeys.unreadCount()
      );

      if (previousCount) {
        queryClient.setQueryData(notificationKeys.unreadCount(), {
          unread_count: Math.max(0, previousCount.unread_count - notificationIds.length),
        });
      }

      return { previousCount };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousCount) {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationType?: string) => markAllAsRead(notificationType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    // Optimistic update
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });

      const previousCount = queryClient.getQueryData<{ unread_count: number }>(
        notificationKeys.unreadCount()
      );

      queryClient.setQueryData(notificationKeys.unreadCount(), { unread_count: 0 });

      return { previousCount };
    },
    onError: (_, __, context) => {
      if (context?.previousCount) {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
    },
  });
}

/**
 * Hook to delete a notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook to delete all read notifications
 */
export function useDeleteAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

/**
 * Hook to update notification preference
 */
export function useUpdatePreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      notificationType,
      updates,
    }: {
      notificationType: string;
      updates: {
        in_app_enabled?: boolean;
        email_enabled?: boolean;
        email_digest?: boolean;
      };
    }) => updatePreference(notificationType, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}

/**
 * Hook to reset notification preferences
 */
export function useResetPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => resetPreferences(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}

/**
 * Helper to format notification time
 */
export function formatNotificationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
