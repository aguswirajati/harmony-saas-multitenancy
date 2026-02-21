/**
 * Notifications API
 * User notification management
 */
import { apiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  data?: Record<string, unknown>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface NotificationCountResponse {
  unread_count: number;
}

export interface NotificationType {
  type: string;
  category: string;
  name: string;
}

export interface NotificationPreference {
  notification_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_digest: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreference[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * List notifications with pagination and filtering
 */
export async function listNotifications(params?: {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
  notification_type?: string;
}): Promise<NotificationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params?.unread_only) searchParams.set('unread_only', 'true');
  if (params?.notification_type) searchParams.set('notification_type', params.notification_type);

  const query = searchParams.toString();
  const response = await apiClient.get(`/notifications${query ? `?${query}` : ''}`);
  return response.data;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<NotificationCountResponse> {
  const response = await apiClient.get('/notifications/count');
  return response.data;
}

/**
 * Get available notification types
 */
export async function getNotificationTypes(): Promise<{ types: NotificationType[] }> {
  const response = await apiClient.get('/notifications/types');
  return response.data;
}

/**
 * Get a specific notification
 */
export async function getNotification(id: string): Promise<Notification> {
  const response = await apiClient.get(`/notifications/${id}`);
  return response.data;
}

/**
 * Mark specific notifications as read
 */
export async function markAsRead(notificationIds: string[]): Promise<{ marked_read: number }> {
  const response = await apiClient.post('/notifications/mark-read', {
    notification_ids: notificationIds,
  });
  return response.data;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(notificationType?: string): Promise<{ marked_read: number }> {
  const response = await apiClient.post('/notifications/mark-all-read', {
    notification_type: notificationType,
  });
  return response.data;
}

/**
 * Delete a notification
 */
export async function deleteNotification(id: string): Promise<{ deleted: boolean }> {
  const response = await apiClient.delete(`/notifications/${id}`);
  return response.data;
}

/**
 * Delete all read notifications
 */
export async function deleteAllRead(): Promise<{ deleted: number }> {
  const response = await apiClient.delete('/notifications');
  return response.data;
}

// ============================================================================
// Preferences API
// ============================================================================

/**
 * Get all notification preferences
 */
export async function getPreferences(): Promise<NotificationPreferencesResponse> {
  const response = await apiClient.get('/notifications/preferences/all');
  return response.data;
}

/**
 * Update a notification preference
 */
export async function updatePreference(
  notificationType: string,
  updates: {
    in_app_enabled?: boolean;
    email_enabled?: boolean;
    email_digest?: boolean;
  }
): Promise<NotificationPreference> {
  const response = await apiClient.put('/notifications/preferences', {
    notification_type: notificationType,
    ...updates,
  });
  return response.data;
}

/**
 * Update multiple preferences at once
 */
export async function updatePreferencesBulk(
  preferences: Array<{
    notification_type: string;
    in_app_enabled?: boolean;
    email_enabled?: boolean;
    email_digest?: boolean;
  }>
): Promise<NotificationPreferencesResponse> {
  const response = await apiClient.put('/notifications/preferences/bulk', {
    preferences,
  });
  return response.data;
}

/**
 * Reset all preferences to defaults
 */
export async function resetPreferences(): Promise<{ reset: number }> {
  const response = await apiClient.delete('/notifications/preferences/reset');
  return response.data;
}

// ============================================================================
// Notification Categories
// ============================================================================

export const NOTIFICATION_CATEGORIES = {
  system: {
    name: 'System',
    description: 'Platform announcements and maintenance notifications',
  },
  billing: {
    name: 'Billing',
    description: 'Subscription and payment notifications',
  },
  user: {
    name: 'Team',
    description: 'Team member invitations and changes',
  },
  tenant: {
    name: 'Organization',
    description: 'Organization settings and branch changes',
  },
  usage: {
    name: 'Usage',
    description: 'Quota and usage warnings',
  },
  security: {
    name: 'Security',
    description: 'Login and password notifications',
  },
};

/**
 * Get category from notification type
 */
export function getCategoryFromType(type: string): string {
  return type.split('.')[0] || 'system';
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'normal':
      return 'text-blue-500';
    case 'low':
      return 'text-gray-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: string): string {
  const category = getCategoryFromType(type);
  switch (category) {
    case 'billing':
      return 'credit-card';
    case 'user':
      return 'users';
    case 'tenant':
      return 'building';
    case 'usage':
      return 'bar-chart';
    case 'security':
      return 'shield';
    default:
      return 'bell';
  }
}
