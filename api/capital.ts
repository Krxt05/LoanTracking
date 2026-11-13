// api/capital.ts - Vercel Serverless Function
// เก็บ "ทุนตั้งต้น" ไว้ใน Vercel KV เพื่อให้มือถือ/คอมเห็นค่าเดียวกัน
//   GET  → { capital, updatedAt, history }
//   POST { capital, bankBalance? } → บันทึกค่าใหม่ + เก็บประวัติ 20 ครั้งล่าสุด

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const KV_KEY = 'loan_capital';
const DEFAULT_CAPITAL = 11980;

type Entry = { capital: number; bankBalance?: number; at: string };
type Stored = { capital: number; updatedAt?: string; history?: Entry[] };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const stored = await kv.get<Stored>(KV_KEY);
      return res.status(200).json(stored ?? { capital: DEFAULT_CAPITAL, history: [] });
    }

    if (req.method === 'POST') {
      const capital = Number(req.body?.capital);
      const bankBalance = req.body?.bankBalance === undefined ? undefined : Number(req.body.bankBalance);
      if (!Number.isFinite(capital) || capital <= 0 || capital > 10_000_000) {
        return res.status(400).json({ error: 'ทุนต้องเป็นตัวเลขมากกว่า 0' });
      }

      const prev = (await kv.get<Stored>(KV_KEY)) ?? { capital: DEFAULT_CAPITAL, history: [] };
      const at = new Date().toISOString();
      const next: Stored = {
        capital: Math.round(capital),
        updatedAt: at,
        history: [
          { capital: Math.round(capital), ...(Number.isFinite(bankBalance) ? { bankBalance } : {}), at },
          ...(prev.history ?? []),
        ].slice(0, 20),
      };
      await kv.set(KV_KEY, next);
      return res.status(200).json(next);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
