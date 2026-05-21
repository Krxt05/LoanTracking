// api/notify.ts - Vercel Serverless Function
// ดึงข้อมูลจาก Google Sheets แล้วส่ง Push Notification ไปยังอุปกรณ์ที่ subscribe ไว้
// ถูก trigger โดย vercel.json cron schedule

import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { kv } from '@vercel/kv';

const KV_KEY = 'push_subscriptions';
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYsFTD4K-tyIFIJry2YLJtnv6gUxZy9VZCvRZcOeGrD9X7inE8udy-cJU_ajJEWcouDSswJZYdAjE8/pub?gid=164801172&single=true&output=csv';

webpush.setVapidDetails(
  'mailto:admin@loantrack.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function parseThaiDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]), m = parseInt(parts[1]), y = parseInt(parts[2]);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

function parseNum(val: any): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/,/g, '')) || 0;
}

function formatBaht(n: number): string {
  return '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function formatNameList(loans: { name: string; totalExpected: number }[], limit = 3): string {
  const shown = loans.slice(0, limit).map(l => `${l.name} ${formatBaht(l.totalExpected)}`);
  const extra = loans.length - limit;
  return shown.join(', ') + (extra > 0 ? ` +${extra} ราย` : '');
}

async function fetchLoanData() {
  const resp = await fetch(`${CSV_URL}&_=${Date.now()}`);
  const text = await resp.text();

  const rows = text.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
  if (rows.length < 4) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const loans = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || !row[1]) continue;
    const status = String(row[12] || '').trim();
    const isPaid = status.includes('ชำระแล้ว') || status.includes('paid') || status.includes('ปิดยอด');
    const isScam = status.includes('บิด');
    const isRenewed = status.includes('ต่อดอก');
    const isWithdrawn = status.includes('เบิก');

    if (isPaid || isScam || isRenewed || isWithdrawn) continue;

    const dueDate = parseThaiDate(String(row[4] || ''));
    if (!dueDate) continue;

    const dueTime = dueDate.getTime();
    const isDueToday = dueTime === today.getTime();
    const isOverdue = dueTime < today.getTime();
    const isDueTomorrow = dueTime === tomorrow.getTime();

    if (isDueToday || isOverdue || isDueTomorrow) {
      loans.push({
        name: String(row[1] || '').trim(),
        totalExpected: parseNum(row[11]),
        dueDate: String(row[4] || ''),
        isDueToday,
        isOverdue,
        isDueTomorrow,
        daysLate: parseNum(row[7])
      });
    }
  }
  return loans;
}

async function loadSubscriptions(): Promise<object[]> {
  const data = await kv.get<Record<string, object>>(KV_KEY);
  return data ? Object.values(data) : [];
}

async function sendToAll(payload: object) {
  const subs = await loadSubscriptions();
  console.log(`📤 Sending to ${subs.length} subscription(s)...`);

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify(payload)))
  );

  const success = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
  failed.forEach((r, i) => console.error(`❌ Push fail [${i}]:`, r.reason?.statusCode, r.reason?.body || r.reason?.message));
  return { success, fail: failed.length };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    const bodySecret = (req.body as any)?.secret;
    if (bodySecret !== process.env.CRON_SECRET && req.method !== 'GET') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const loans = await fetchLoanData();
    const dueToday = loans.filter(l => l.isDueToday);
    const overdue = loans.filter(l => l.isOverdue);
    const dueTomorrow = loans.filter(l => l.isDueTomorrow);

    const type = (req.query.type || req.body?.type || 'morning') as string;

    let payload: object | null = null;

    if (type === 'morning') {
      // 🌅 06:00 น. — สรุปยอดประจำวัน
      const total = dueToday.length + overdue.length;
      if (total === 0) {
        payload = {
          title: '🌅 LoanTrack — สรุปยอดวันนี้',
          body: '✅ วันนี้ไม่มียอดที่ต้องติดตาม',
          icon: '/icon.png', url: '/'
        };
      } else {
        const todayTotal = dueToday.reduce((s, l) => s + l.totalExpected, 0);
        const overdueTotal = overdue.reduce((s, l) => s + l.totalExpected, 0);
        const lines: string[] = [];
        if (dueToday.length > 0) lines.push(`📋 วันนี้: ${formatNameList(dueToday)} | รวม ${formatBaht(todayTotal)}`);
        if (overdue.length > 0) {
          const maxDays = Math.max(...overdue.map(l => l.daysLate));
          lines.push(`⚠️ ค้างชำระ: ${overdue.length} ราย (+${maxDays}วัน) | รวม ${formatBaht(overdueTotal)}`);
        }
        payload = {
          title: '🌅 LoanTrack — สรุปยอดวันนี้',
          body: lines.join('\n'),
          icon: '/icon.png', url: '/'
        };
      }

    } else if (type === 'afternoon') {
      // 🔔 16:00 น. — รายการที่ยังไม่ชำระ
      if (dueToday.length === 0) {
        payload = {
          title: '🔔 LoanTrack — รายการรอติดตาม',
          body: '✅ ยอดทั้งหมดของวันนี้ชำระแล้ว!',
          icon: '/icon.png', url: '/'
        };
      } else {
        const total = dueToday.reduce((s, l) => s + l.totalExpected, 0);
        payload = {
          title: '🔔 LoanTrack — รายการรอติดตาม',
          body: `ยังมี ${dueToday.length} ราย รอติดตาม — ทักก่อนดึก\n${formatNameList(dueToday)} | รวม ${formatBaht(total)}`,
          icon: '/icon.png', url: '/'
        };
      }

    } else if (type === 'evening') {
      // 📅 18:00 น. — แจ้งล่วงหน้าครบกำหนดพรุ่งนี้
      if (dueTomorrow.length === 0) {
        // ไม่มีอะไรพรุ่งนี้ ไม่ต้องส่ง
        return res.status(200).json({ success: true, type, skipped: true, reason: 'no loans due tomorrow' });
      }
      const total = dueTomorrow.reduce((s, l) => s + l.totalExpected, 0);
      payload = {
        title: '📅 LoanTrack — ครบกำหนดพรุ่งนี้',
        body: `${dueTomorrow.length} ราย นัดชำระพรุ่งนี้ รวม ${formatBaht(total)}\n${formatNameList(dueTomorrow)}`,
        icon: '/icon.png', url: '/'
      };
    }

    if (!payload) {
      return res.status(400).json({ error: `Unknown type: ${type}` });
    }

    const result = await sendToAll(payload);

    return res.status(200).json({
      success: true, type,
      dueToday: dueToday.length,
      overdue: overdue.length,
      dueTomorrow: dueTomorrow.length,
      notification: payload,
      sent: result
    });
  } catch (err: any) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
}
