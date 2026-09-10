export function browserNotificationsAvailable() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestBrowserNotifications() {
  if (!browserNotificationsAvailable()) return 'denied' as const;
  return Notification.requestPermission();
}

export function notifyAboutMessage(title: string, body: string, tag: string) {
  if (!browserNotificationsAvailable() || Notification.permission !== 'granted' || !document.hidden) return;
  const notification = new Notification(title, { body, tag });
  notification.onclick = () => { window.focus(); notification.close(); };
}
