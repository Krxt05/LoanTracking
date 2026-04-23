// api/subscribe.ts - Vercel Serverless Function
// รับและจัดเก็บ Push Subscription จากแอป iPhone
// Deploy บน Vercel: ไฟล์ใน /api จะถูกรันเป็น serverless functions อัตโนมัติ

import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

// หมายเหตุ: ในการ Production จริงควรใช้ฐานข้อมูล (เช่น Vercel KV, MongoDB Atlas)
// แต่สำหรับการใช้งานส่วนตัวคน-2 คน ใช้ /tmp เพื่อ simplicity
const SUBS_PATH = '/tmp/subscriptions.json';

function loadSubscriptions(): Record<string, object> {
  try {
    if (fs.existsSync(SUBS_PATH)) {
      return JSON.parse(fs.readFileSync(SUBS_PATH, 'utf-8'));
    }
  } catch (_) {}
  return {};
}

function saveSubscriptions(subs: Record<string, object>) {
  fs.writeFileSync(SUBS_PATH, JSON.stringify(subs, null, 2));
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const subscription = req.body;
      if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
      
      const subs = loadSubscriptions();
      subs[subscription.endpoint] = subscription;
      saveSubscriptions(subs);
      
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
      
      const subs = loadSubscriptions();
      delete subs[endpoint];
      saveSubscriptions(subs);
      
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
