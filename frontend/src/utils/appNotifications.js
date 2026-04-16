export const APP_NOTIFICATION_EVENT = "app-notification-added";
const STORAGE_KEY = "app-notifications";
const MAX_NOTIFICATIONS = 25;

const readSafe = () => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getAppNotifications = () => readSafe();

export const saveAppNotifications = (notifications) => {
  if (typeof window === "undefined") return [];
  const next = notifications.slice(0, MAX_NOTIFICATIONS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(APP_NOTIFICATION_EVENT, { detail: next }));
  return next;
};

export const pushAppNotification = ({
  title,
  message = "",
  tone = "info",
  href = "",
  meta = "",
} = {}) => {
  if (typeof window === "undefined" || !title) return [];
  const nextNotification = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    message,
    tone,
    href,
    meta,
    createdAt: new Date().toISOString(),
    read: false,
  };
  return saveAppNotifications([nextNotification, ...readSafe()]);
};

export const markNotificationRead = (notificationId) =>
  saveAppNotifications(
    readSafe().map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification,
    ),
  );

export const markAllNotificationsRead = () =>
  saveAppNotifications(readSafe().map((notification) => ({ ...notification, read: true })));

export const clearNotifications = () => saveAppNotifications([]);
