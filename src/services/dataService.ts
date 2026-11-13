// ─────────────────────────────────────────────────────────────
// dataService.ts — ดึงและแปลง CSV จาก Google Sheets
//
// CSV column index (row[i]):
//   0  = ID         1  = ชื่อ          2  = เงินต้น
//   3  = วันยืม     4  = วันครบกำหนด  5  = วันที่จ่ายจริง
//   6  = จำนวนวัน   7  = วันค้าง      8  = อัตราดอก
//   9  = ดอกที่คาด  10 = ค่าปรับ      11 = ยอดรวมที่คาด
//   12 = สถานะ      13 = ยอดจ่าย      14 = ต้นที่จ่าย
//   15 = ดอกที่จ่าย 16 = หมายเหตุ
//
// historicalRenewalInterest / Count:
//   สะสมต่อคนแบบ running total ตามลำดับ row จากบนลงล่าง
//   รีเซตทุกครั้งที่ row นั้น isPaid หรือ isScam (จบรอบ)
// ─────────────────────────────────────────────────────────────
import Papa from 'papaparse';
import { parseNumeric, parseThaiDate } from '../lib/utils';

export const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYsFTD4K-tyIFIJry2YLJtnv6gUxZy9VZCvRZcOeGrD9X7inE8udy-cJU_ajJEWcouDSswJZYdAjE8/pub?gid=164801172&single=true&output=csv';

// ทุนตั้งต้น (ค่าเริ่มต้น) — ค่าจริงเก็บใน Vercel KV ผ่าน /api/capital
// และปรับได้จากในแอป (ปุ่ม "เช็คกับบัญชีจริง") ไม่ต้องแก้โค้ด
// 11,980 = เงินในบัญชีจริง 4,000 + ปล่อยกู้อยู่ 9,500 − กำไรที่ได้แล้ว 1,520 (14/11/2026)
export const DEFAULT_CAPITAL = 11980;

export interface CapitalConfig {
  capital: number;
  updatedAt?: string;
  history?: { capital: number; bankBalance?: number; at: string }[];
}

export async function fetchCapital(): Promise<CapitalConfig> {
  try {
    const res = await fetch('/api/capital', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    if (typeof json?.capital === 'number' && json.capital > 0) return json;
  } catch (e) {
    console.warn('fetchCapital fallback to default:', e);
  }
  return { capital: DEFAULT_CAPITAL };
}

export async function saveCapital(capital: number, bankBalance?: number): Promise<CapitalConfig | null> {
  try {
    const res = await fetch('/api/capital', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capital, bankBalance }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface DashboardSummary {
  available: number;       // ยอดว่าง
  totalLimit: number;      // วงเงินปัจจุบัน
  profitPct: number;       // %กำไร
  grossProfit: number;     // กำไร
  netProfit: number;       // กำไรสุทธิ
  withdrawn: number;       // เบิก
  totalExpected: number;   // ยอดรวมทั้งหมด
  totalPaid: number;       // ยอดจ่ายแล้วรวม
  totalUnpaid: number;     // ยอดยังไม่จ่ายรวม
  totalBorrowed: number;   // ยอดยืมรวม
  totalInterest: number;   // ดอกเบี้ยรวม
  paidPrincipal: number;   // จ่ายต้นแล้ว
  paidInterest: number;    // จ่ายดอกแล้ว
  unpaidPrincipal: number; // ยังไม่จ่ายต้น
  unpaidInterest: number;  // ยังไม่จ่ายดอก
  scamPrincipal: number;   // ต้นที่โดนบิด
}

export interface PenaltyRecord {
  date: string;
  amount: number;
}

export interface LoanRecord {
  id: string;
  name: string;
  principal: number;
  borrowDate: string;
  dueDate: string;
  actualDate: string;
  daysBorrowed: number;
  daysLate: number;
  interestRate: number;
  expectedInterest: number;
  penalty: number;
  totalExpected: number;
  status: string;
  paidAmount: number;
  paidPrincipal: number;
  paidInterest: number;
  isPaid: boolean;
  isOverdue: boolean;
  isScam: boolean;
  isRenewed: boolean;
  isWithdrawn: boolean;
  historicalRenewalInterest: number;
  historicalRenewalCount: number;
  penaltyHistory: PenaltyRecord[];
  note: string;
}

export interface AppData {
  summary: DashboardSummary;
  loans: LoanRecord[];
}

export async function fetchAppData(capital: number = DEFAULT_CAPITAL): Promise<AppData | null> {
  const fetchProcess = async () => {
    return await new Promise<AppData | null>((resolve) => {
      Papa.parse(`${CSV_URL}&_=${new Date().getTime()}`, {
        download: true,
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const data = results.data as string[][];
            if (!data || data.length < 3) return resolve(null);

            const loans: LoanRecord[] = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const cycleAccumulatedAcc: Record<string, number> = {};
            const cycleAccumulatedCount: Record<string, number> = {};
            const personPenaltyHistory: Record<string, PenaltyRecord[]> = {};

            for (let i = 3; i < data.length; i++) {
              const row = data[i];
              if (!row || !row[0] || !row[1]) continue;

              const name = String(row[1] || '').trim();
              const status = String(row[12] || '').trim();
              const isPaid = status.toLowerCase().includes('ชำระแล้ว') || status.toLowerCase().includes('paid') || status.toLowerCase().includes('ปิดยอด');

              const dueDateStr = String(row[4] || '');
              const parsedDueDate = parseThaiDate(dueDateStr);
              const isScam = status.toLowerCase().includes('บิด');
              const isRenewed = status.includes('ต่อดอก');
              const isWithdrawn = status.includes('เบิก');
              const paidInterest = parseNumeric(row[15]);
              const penaltyAmount = parseNumeric(row[10]);

              if (!personPenaltyHistory[name]) personPenaltyHistory[name] = [];
              if ((isPaid || isRenewed) && penaltyAmount > 0) {
                personPenaltyHistory[name].push({
                  date: String(row[5] || '') || dueDateStr,
                  amount: penaltyAmount
                });
              }

              let isOverdue = false;
              if (!isPaid && !isScam && !isRenewed && !isWithdrawn && parsedDueDate) {
                isOverdue = parsedDueDate.getTime() < today.getTime();
              }

              let daysLate = parseNumeric(row[7]);
              if (isOverdue && parsedDueDate) {
                const calcDaysLate = Math.ceil((today.getTime() - parsedDueDate.getTime()) / 86400000);
                if (daysLate === 0 || calcDaysLate > daysLate) daysLate = Math.max(1, calcDaysLate);
              }

              let historicalRenewalInterest = cycleAccumulatedAcc[name] || 0;
              let historicalRenewalCount = cycleAccumulatedCount[name] || 0;

              if (isRenewed) {
                historicalRenewalInterest += paidInterest;
                historicalRenewalCount += 1;
              }

              loans.push({
                id: String(row[0] || '').trim(),
                name,
                principal: parseNumeric(row[2]),
                borrowDate: String(row[3] || ''),
                dueDate: dueDateStr,
                actualDate: String(row[5] || ''),
                daysBorrowed: parseNumeric(row[6]),
                daysLate,
                interestRate: parseNumeric(row[8]),
                expectedInterest: parseNumeric(row[9]),
                penalty: parseNumeric(row[10]),
                totalExpected: parseNumeric(row[11]),
                status: status,
                paidAmount: parseNumeric(row[13]),
                paidPrincipal: parseNumeric(row[14]),
                paidInterest,
                isPaid,
                isOverdue,
                isScam,
                isRenewed,
                isWithdrawn,
                historicalRenewalInterest,
                historicalRenewalCount,
                penaltyHistory: [...(personPenaltyHistory[name] || [])],
                note: String(row[16] || '')
              });

              if (isPaid || isScam) {
                cycleAccumulatedAcc[name] = 0;
                cycleAccumulatedCount[name] = 0;
                personPenaltyHistory[name] = [];
              } else {
                cycleAccumulatedAcc[name] = historicalRenewalInterest;
                cycleAccumulatedCount[name] = historicalRenewalCount;
              }
            }

            const summary = computeSummary(loans, capital);

            resolve({ summary, loans });
          } catch (e) {
            console.error("Parse error:", e);
            resolve(null);
          }
        },
        error: (error) => {
          console.error("PapaParse network error:", error);
          resolve(null);
        }
      });
    });
  };

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.error("fetchAppData purely timed out after 10 seconds");
      resolve(null);
    }, 10000);
  });

  return Promise.race([fetchProcess(), timeoutPromise]);
}

// ── ข้อความทวงหนี้ ──
// ตัวแปรที่ใช้ได้: {ยอด} {ต้น} {ดอก} {ชื่อ} {กำหนด}
export const DEFAULT_REMINDER =
`🚨วันนี้มีส่งยอด {ยอด} ก่อน 16.00 นะครับ ช้าปรับชั่วโมงละ20 เลทวันถัดไปปรับวันละ200นะครับ😊 หากไม่สะดวกปิดยอดสามารถต่อดอกได้ครับ (ต่อดอกส่ง {ดอก})
————————————-
(ใส่เลขบัญชี ธนาคาร และชื่อบัญชี ในแท็บ "คุณ" → ข้อความทวงหนี้)
ส่งยอดบช.นี้นะครับ`;

export async function fetchReminderTemplate(): Promise<string | null> {
  try {
    const res = await fetch('/api/reminder', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.template === 'string' ? json.template : null;
  } catch { return null; }
}

export async function saveReminderTemplate(template: string): Promise<boolean> {
  try {
    const res = await fetch('/api/reminder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template }),
    });
    return res.ok;
  } catch { return false; }
}

export function renderReminder(template: string, l: LoanRecord): string {
  const n = (v: number) => String(Math.round(v));
  const total = l.principal + l.expectedInterest + (l.penalty || 0);
  return template
    .replace(/\{ยอด\}/g, n(total))
    .replace(/\{ต้น\}/g, n(l.principal))
    .replace(/\{ดอก\}/g, n(l.expectedInterest))
    .replace(/\{ชื่อ\}/g, l.name)
    .replace(/\{กำหนด\}/g, l.dueDate);
}

// สรุปยอดจากรายการกู้ + ทุนตั้งต้น
//   วงเงิน   = ทุน + ดอกที่ได้รับ − โดนบิด − เบิก
//   ยอดว่าง = วงเงิน − ต้นที่ปล่อยกู้อยู่  (= เงินที่ควรอยู่ในบัญชีจริง)
export function computeSummary(loans: LoanRecord[], capital: number): DashboardSummary {
  let paidPrincipal = 0, paidInterest = 0;
  let unpaidPrincipal = 0, unpaidInterest = 0;
  let scamPrincipal = 0, withdrawnTotal = 0;

  for (const l of loans) {
    if (l.isWithdrawn) {
      withdrawnTotal += l.principal;
    } else if (l.isScam) {
      scamPrincipal += l.principal;
    } else if (l.isPaid) {
      paidPrincipal += l.paidPrincipal;
      paidInterest += l.paidInterest;
    } else if (l.isRenewed) {
      paidInterest += l.paidInterest;
    } else {
      unpaidPrincipal += l.principal;
      unpaidInterest += l.expectedInterest;
    }
  }

  const totalLimit = capital + paidInterest - scamPrincipal - withdrawnTotal;
  const totalExpected = unpaidPrincipal + unpaidInterest;
  return {
    available: totalLimit - unpaidPrincipal,
    totalLimit,
    profitPct: capital > 0 ? ((totalLimit - capital) / capital) * 100 : 0,
    grossProfit: paidInterest,
    netProfit: paidInterest - scamPrincipal - withdrawnTotal,
    withdrawn: withdrawnTotal,
    totalExpected,
    totalPaid: paidPrincipal + paidInterest,
    totalUnpaid: totalExpected,
    totalBorrowed: paidPrincipal + unpaidPrincipal + scamPrincipal,
    totalInterest: paidInterest + unpaidInterest,
    paidPrincipal,
    paidInterest,
    unpaidPrincipal,
    unpaidInterest,
    scamPrincipal,
  };
}

// URL ของ Web App ที่ได้จาก Google Apps Script (ตอน Deploy)
export const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby-lRM0gDRdqvyVYbIj4_-PrGOoxO_BDKbdJ012PhWGWIkzruVehHl1Td6ArovHnQs/exec";

export async function updateLoanStatus(id: string, action: 'ชำระแล้ว' | 'ต่อดอก' | 'โดนบิด', actionDate?: string, penalty?: number, renewFromDate?: string): Promise<boolean> {
  if (!GOOGLE_SCRIPT_WEB_APP_URL) {
    console.error("Missing GOOGLE_SCRIPT_WEB_APP_URL");
    return false;
  }

  try {
    const urlWithParams = new URL(GOOGLE_SCRIPT_WEB_APP_URL);
    urlWithParams.searchParams.append('id', id);
    urlWithParams.searchParams.append('action', action);
    if (actionDate) {
      urlWithParams.searchParams.append('actionDate', actionDate);
    }
    urlWithParams.searchParams.append('penalty', (penalty ?? 0).toString());
    if (renewFromDate) {
      urlWithParams.searchParams.append('renewFromDate', renewFromDate);
    }

    const response = await fetch(urlWithParams.toString(), {
      method: "GET"
    });
    
    const result = await response.json();
    return result.success;
  } catch (error: any) {
    console.error("Failed to update status:", error);
    return false;
  }
}

export async function editExistingLoan(id: string, editData: {
  principal: number;
  borrowDate?: string; // dd/MM/yyyy
  dueDate: string; // dd/MM/yyyy
  daysBorrowed: number;
  interestRate: number;
  expectedInterest?: number;
}): Promise<boolean> {
  if (!GOOGLE_SCRIPT_WEB_APP_URL) {
    return false;
  }

  try {
    const urlWithParams = new URL(GOOGLE_SCRIPT_WEB_APP_URL);
    urlWithParams.searchParams.append('id', id);
    urlWithParams.searchParams.append('action', 'EDIT_LOAN');
    urlWithParams.searchParams.append('principal', editData.principal.toString());
    if (editData.borrowDate) urlWithParams.searchParams.append('borrowDate', editData.borrowDate);
    urlWithParams.searchParams.append('dueDate', editData.dueDate);
    urlWithParams.searchParams.append('daysBorrowed', editData.daysBorrowed.toString());
    urlWithParams.searchParams.append('interestRate', editData.interestRate.toString());
    if (editData.expectedInterest !== undefined) urlWithParams.searchParams.append('expectedInterest', editData.expectedInterest.toString());

    const response = await fetch(urlWithParams.toString(), {
      method: "GET"
    });
    
    const result = await response.json();
    return result.success;
  } catch (error: any) {
    console.error("Failed to edit loan:", error);
    return false;
  }
}

export async function createNewLoan(loanData: {
  name: string;
  principal: number;
  borrowDate: string; // dd/MM/yyyy
  dueDate: string; // dd/MM/yyyy
  daysBorrowed: number;
  interestRate: number;
  status?: string;
  note?: string;
}): Promise<{ success: boolean; id?: string }> {
  if (!GOOGLE_SCRIPT_WEB_APP_URL) {
    console.error("Missing GOOGLE_SCRIPT_WEB_APP_URL");
    return { success: false };
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "NEW", // ID จำลองเพื่อบอกว่าเป็นรายการใหม่
        action: "NEW_LOAN",
        loanData: loanData
      }),
    });

    // เนื่องจากใช้ no-cors เราไม่สามารถอ่าน response จริงได้ แต่สมมติว่าสำเร็จ
    console.log("Create new loan request sent for:", loanData.name);
    return { success: true, id: "L" + Date.now().toString().slice(-6) }; 
  } catch (error) {
    console.error("Error creating new loan:", error);
    return { success: false };
  }
}
