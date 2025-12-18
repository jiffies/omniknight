import { useCallback, useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  permission: NotificationPermission | 'unsupported';
}

/**
 * Web Push 通知订阅 Hook
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    error: null,
    permission: 'unsupported',
  });

  // 检查是否支持 Push API
  const checkSupport = useCallback(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    return { supported, permission };
  }, []);

  // 注册 Service Worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker 不支持');
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push] Service Worker 已注册');

    // 等待 Service Worker 激活
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener('statechange', function handler() {
          if (this.state === 'activated') {
            this.removeEventListener('statechange', handler);
            resolve();
          }
        });
      });
    }

    return registration;
  }, []);

  // 获取 VAPID 公钥
  const getVapidPublicKey = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/push/vapid-public-key`);
      const data = await response.json();
      if (!data.enabled || !data.publicKey) {
        console.log('[Push] 服务器未启用推送');
        return null;
      }
      return data.publicKey;
    } catch (error) {
      console.error('[Push] 获取 VAPID 公钥失败:', error);
      return null;
    }
  }, []);

  // 将 Base64 URL 转换为 Uint8Array
  const urlBase64ToUint8Array = useCallback((base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  // 订阅推送
  const subscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // 请求通知权限
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('通知权限被拒绝');
      }

      // 注册 Service Worker
      const registration = await registerServiceWorker();

      // 获取 VAPID 公钥
      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) {
        throw new Error('服务器未配置推送功能');
      }

      // 订阅推送
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      console.log('[Push] 订阅成功:', subscription.endpoint.slice(0, 50) + '...');

      // 将订阅发送到服务器
      const response = await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(
              String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!)),
            ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            auth: btoa(
              String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)),
            ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('服务器保存订阅失败');
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        permission: 'granted',
      }));

      console.log('[Push] 订阅已保存到服务器');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '订阅失败';
      console.error('[Push] 订阅失败:', errorMessage);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [registerServiceWorker, getVapidPublicKey, urlBase64ToUint8Array]);

  // 取消订阅
  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 通知服务器
        await fetch(`${API_BASE}/api/push/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });

        // 取消订阅
        await subscription.unsubscribe();
        console.log('[Push] 已取消订阅');
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '取消订阅失败';
      console.error('[Push] 取消订阅失败:', errorMessage);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  // 初始化检查
  useEffect(() => {
    async function init() {
      const { supported, permission } = checkSupport();

      if (!supported) {
        setState({
          isSupported: false,
          isSubscribed: false,
          isLoading: false,
          error: null,
          permission: 'unsupported',
        });
        return;
      }

      // 检查是否已订阅
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        setState({
          isSupported: true,
          isSubscribed: !!subscription,
          isLoading: false,
          error: null,
          permission,
        });
      } catch (error) {
        setState({
          isSupported: true,
          isSubscribed: false,
          isLoading: false,
          error: null,
          permission,
        });
      }
    }

    init();
  }, [checkSupport]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
