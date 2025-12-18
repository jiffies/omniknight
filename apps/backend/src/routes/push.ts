import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  getVapidPublicKey,
  isPushEnabled,
  removeSubscription,
  saveSubscription,
} from '../services/push/push-service';

const pushRoute = new Hono()
  // 获取 VAPID 公钥
  .get('/vapid-public-key', (c) => {
    const publicKey = getVapidPublicKey();
    return c.json({
      enabled: isPushEnabled(),
      publicKey,
    });
  })

  // 订阅推送
  .post(
    '/subscribe',
    zValidator(
      'json',
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
        userAgent: z.string().optional(),
      }),
    ),
    async (c) => {
      if (!isPushEnabled()) {
        return c.json({ error: '推送服务未启用' }, 503);
      }

      const body = c.req.valid('json');
      const subscription = await saveSubscription({
        endpoint: body.endpoint,
        keys: body.keys,
        userAgent: body.userAgent,
      });

      return c.json({ success: true, id: subscription?.id });
    },
  )

  // 取消订阅
  .post(
    '/unsubscribe',
    zValidator(
      'json',
      z.object({
        endpoint: z.string().url(),
      }),
    ),
    async (c) => {
      const { endpoint } = c.req.valid('json');
      await removeSubscription(endpoint);
      return c.json({ success: true });
    },
  );

export default pushRoute;
