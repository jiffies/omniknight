// Service Worker for Web Push Notifications

// 安装事件
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker 安装中...');
  // 立即激活，不等待
  self.skipWaiting();
});

// 激活事件
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker 已激活');
  // 立即接管所有页面
  event.waitUntil(self.clients.claim());
});

// 接收推送消息
self.addEventListener('push', (event) => {
  console.log('[SW] 收到推送消息');

  let data = {
    title: '新通知',
    body: '您有一条新消息',
    icon: '/favicon.ico',
    tag: 'default',
    data: {},
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('[SW] 解析推送数据失败:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag,
    data: data.data,
    requireInteraction: false,
    // 通知操作按钮
    actions: [
      {
        action: 'view',
        title: '查看',
      },
      {
        action: 'close',
        title: '关闭',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 点击通知
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 通知被点击', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // 获取通知中的 URL 数据
  const urlToOpen = event.notification.data?.url || '/tasks';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 如果已经有打开的窗口，聚焦并导航
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // 否则打开新窗口
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    }),
  );
});

// 订阅变更事件
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] 订阅已变更，需要重新订阅');
  // 这里可以通知前端重新订阅
});
