// api/notify.ts - Vercel Serverless Function
// ดึงข้อมูลจาก Google Sheets แล้วส่ง Push Notification ไปยังอุปกรณ์ที่ subscribe ไว้
// ถูก trigger โดย vercel.json cron schedule

import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import fs from 'fs';

const SUBS_PATH = '/tmp/subscriptions.json';
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

async function fetchLoanData() {
  const resp = await fetch(`${CSV_URL}&_=${Date.now()}`);
  const text = await resp.text();
  
  const rows = text.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
  if (rows.length < 4) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    
    if (isDueToday || isOverdue) {
      loans.push({
        name: String(row[1] || '').trim(),
        totalExpected: parseNum(row[11]),
        dueDate: String(row[4] || ''),
        isDueToday,
        isOverdue,
        daysLate: parseNum(row[7])
      });
    }
  }
  return loans;
}

function loadSubscriptions(): object[] {
  try {
    if (fs.existsSync(SUBS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SUBS_PATH, 'utf-8'));
      return Object.values(data);
    }
  } catch (_) {}
  return [];
}

async function sendToAll(payload: object) {
  const subs = loadSubscriptions();
  console.log(`📤 Sending to ${subs.length} subscription(s)...`);
  
  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify(payload)))
  );
  
  const success = results.filter(r => r.status === 'fulfilled').length;
  const fail = results.filter(r => r.status === 'rejected').length;
  return { success, fail };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ป้องกัน unauthorized access
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    // อนุญาตสำหรับการ test จาก UI ด้วย
    const bodySecret = (req.body as any)?.secret;
    if (bodySecret !== process.env.CRON_SECRET && req.method !== 'GET') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const loans = await fetchLoanData();
    const dueToday = loans.filter(l => l.isDueToday);
    const overdue = loans.filter(l => l.isOverdue);

    // เช็คว่าเป็น trigger แบบไหน (6โมงเช้า หรือ 16.00น.)
    const type = (req.query.type || req.body?.type || 'morning') as string;

    let payload;
    if (type === 'morning') {
      // 🌅 แจ้งเตือนตอน 6:00น.
      const total = dueToday.length + overdue.length;
      payload = {
        title: `🌅 LoanTrack - สรุปยอดวันนี้`,
        body: total === 0
          ? '✅ วันนี้ไม่มียอดที่ต้องติดตาม'
          : `📋 นัดชำระวันนี้: ${dueToday.length} ราย | ⚠️ ค้างชำระ: ${overdue.length} ราย`,
        icon: '/icon.png',
        url: '/'
      };
    } else {
      // 🔔 แจ้งเตือนตอน 16:00น.
      const unpaids = dueToday.filter(l => l.isDueToday);
      payload = {
        title: `🔔 LoanTrack - ต้องทวงวันนี้!`,
        body: unpaids.length === 0
          ? '✅ ยอดทั้งหมดของวันนี้ชำระแล้ว!'
          : `💬 ยังมี ${unpaids.length} ราย ที่ยังไม่ชำระในวันนี้ รีบตามทวงด่วน!`,
        icon: '/icon.png',
        url: '/'
      };
    }

    const result = await sendToAll(payload);
    
    return res.status(200).json({
      success: true,
      type,
      dueToday: dueToday.length,
      overdue: overdue.length,
      notification: payload,
      sent: result
    });
  } catch (err: any) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
}
