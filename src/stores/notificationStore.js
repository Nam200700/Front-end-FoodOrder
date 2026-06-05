import { create } from 'zustand';
import apiClient from '../services/api';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const response = await apiClient.get('/notifications');
      const content = response.data?.data?.content || [];
      
      const mapped = content.map(n => {
        let timeStr = 'Không rõ';
        if (n.createdAt) {
          const date = new Date(n.createdAt);
          timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${date.toLocaleDateString('vi-VN')}`;
        }
        return {
          id: n.notificationId.toString(),
          title: n.title,
          body: n.body,
          time: timeStr,
          type: n.type, // ORDER_NEW, ORDER_CONFIRMED, ORDER_PREPARING, ORDER_READY_PICKUP, SHIPPER_ASSIGNED, ORDER_COMPLETED, ORDER_CANCELLED
          refId: n.refId ? n.refId.toString() : null,
          isRead: n.isRead
        };
      });
      
      set({ notifications: mapped, loading: false });
    } catch (error) {
      console.error('[Notification Store]: Fetch notifications error', error);
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      const count = response.data?.data?.count || 0;
      set({ unreadCount: count });
    } catch (error) {
      console.error('[Notification Store]: Fetch unread count error', error);
    }
  },

  addNotification: (notification) => {
    const { notifications, unreadCount } = get();
    const newNotif = {
      id: notification.notificationId ? notification.notificationId.toString() : `notif-${Math.random()}`,
      title: notification.title || 'Thông báo mới',
      body: notification.body || '',
      time: 'Vừa xong',
      type: notification.type || 'SYSTEM',
      refId: notification.refId ? notification.refId.toString() : null,
      isRead: false,
      ...notification,
    };

    set({
      notifications: [newNotif, ...notifications],
      unreadCount: unreadCount + 1,
    });
  },

  markRead: async (id) => {
    const { notifications, unreadCount } = get();
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    // Optimistic UI update
    if (!target.isRead) {
      const updated = notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      set({
        notifications: updated,
        unreadCount: Math.max(0, unreadCount - 1),
      });
    }

    try {
      // Do id của thông báo có thể là số thật ở DB Backend nên truyền dạng số
      const numericId = parseInt(id);
      await apiClient.patch(`/notifications/${isNaN(numericId) ? id : numericId}/read`);
    } catch (error) {
      console.error('[Notification Store]: Mark read error', error);
      // Rollback
      get().fetchNotifications();
      get().fetchUnreadCount();
    }
  },

  markAllRead: async () => {
    const { notifications } = get();
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    set({
      notifications: updated,
      unreadCount: 0,
    });

    try {
      await apiClient.patch('/notifications/read-all');
    } catch (error) {
      console.error('[Notification Store]: Mark all read error', error);
      get().fetchNotifications();
      get().fetchUnreadCount();
    }
  },

  clearAll: () => set({
    notifications: [],
    unreadCount: 0,
  }),
}));
