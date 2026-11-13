// api/reminder.ts - เก็บข้อความทวงหนี้ (template) ใน Vercel KV
// ไม่เก็บในโค้ด เพราะ repo เป็น public และข้อความมีเลขบัญชี
//   GET  → { template }
//   POST { template } → บันทึก

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const KV_KEY = 'reminder_template';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const template = await kv.get<string>(KV_KEY);
      return res.status(200).json({ template: template ?? null });
    }
    if (req.method === 'POST') {
      const template = String(req.body?.template ?? '').trim();
      if (!template || template.length > 2000) {
        return res.status(400).json({ error: 'ข้อความต้องไม่ว่าง และยาวไม่เกิน 2000 ตัวอักษร' });
      }
      await kv.set(KV_KEY, template);
      return res.status(200).json({ template });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
