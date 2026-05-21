// api/subscribe.ts - Vercel Serverless Function
// รับและจัดเก็บ Push Subscription จากแอป

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const KV_KEY = 'push_subscriptions';

async function loadSubscriptions(): Promise<Record<string, object>> {
  const data = await kv.get<Record<string, object>>(KV_KEY);
  return data ?? {};
}

async function saveSubscriptions(subs: Record<string, object>) {
  await kv.set(KV_KEY, subs);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const subscription = req.body;
      if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

      const subs = await loadSubscriptions();
      subs[subscription.endpoint] = subscription;
      await saveSubscriptions(subs);

      console.log(`✅ New subscription saved. Total: ${Object.keys(subs).length}`);
      return res.status(201).json({ success: true, total: Object.keys(subs).length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'No endpoint provided' });

      const subs = await loadSubscriptions();
      delete subs[endpoint];
      await saveSubscriptions(subs);

      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
