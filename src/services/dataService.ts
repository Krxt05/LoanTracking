import Papa from 'papaparse';
import { parseNumeric, parseThaiDate } from '../lib/utils';

export const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYsFTD4K-tyIFIJry2YLJtnv6gUxZy9VZCvRZcOeGrD9X7inE8udy-cJU_ajJEWcouDSswJZYdAjE8/pub?gid=164801172&single=true&output=csv';

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
}

export interface AppData {
  summary: DashboardSummary;
  loans: LoanRecord[];
}

export async function fetchAppData(): Promise<AppData | null> {
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

            const gHeaders = data[0];
            const gVals = data[1];

            const getGlobal = (name: string) => {
              const idx = gHeaders.findIndex(h => typeof h === 'string' && h.trim() === name);
              return idx !== -1 ? parseNumeric(gVals[idx]) : 0;
            };

            const lHeaders = data[2];
            const scamFallbackIdx = lHeaders.findIndex(h => typeof h === 'string' && h.includes('โดนบิด'));
            const scamPrincipal = scamFallbackIdx !== -1 ? parseNumeric(gVals[scamFallbackIdx]) : 0;

            const summary: DashboardSummary = {
              available: getGlobal('ยอดว่าง'),
              totalLimit: getGlobal('วงเงินปัจจุบัน'),
              profitPct: getGlobal('%กำไร'),
              grossProfit: getGlobal('กำไร'),
              netProfit: getGlobal('กำไรสุทธิ'),
              withdrawn: getGlobal('เบิก'),
              totalExpected: getGlobal('ยอดรวมทั้งหมด'),
              totalPaid: getGlobal('ยอดจ่ายแล้วรวม'),
              totalUnpaid: getGlobal('ยอดยังไม่จ่ายรวม'),
              totalBorrowed: getGlobal('ยอดยืมรวม'),
              totalInterest: getGlobal('ดอกเบี้ยรวม'),
              paidPrincipal: getGlobal('จ่ายต้นแล้ว'),
              paidInterest: getGlobal('จ่ายดอกแล้ว'),
              unpaidPrincipal: getGlobal('ยังไม่จ่ายต้น'),
              unpaidInterest: getGlobal('ยังไม่จ่ายดอก'),
              scamPrincipal: scamPrincipal
            };

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
                daysLate: parseNumeric(row[7]),
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
                penaltyHistory: [...(personPenaltyHistory[name] || [])]
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

// URL ของ Web App ที่ได้จาก Google Apps Script (ตอน Deploy)
export const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby-lRM0gDRdqvyVYbIj4_-PrGOoxO_BDKbdJ012PhWGWIkzruVehHl1Td6ArovHnQs/exec";

export async function updateLoanStatus(id: string, action: 'ชำระแล้ว' | 'ต่อดอก' | 'โดนบิด', actionDate?: string): Promise<boolean> {
  if (!GOOGLE_SCRIPT_WEB_APP_URL) {
    alert("กรุณาใส่ GOOGLE_SCRIPT_WEB_APP_URL ในไฟล์ src/services/dataService.ts ก่อนครับ");
    return false;
  }

  try {
    const urlWithParams = new URL(GOOGLE_SCRIPT_WEB_APP_URL);
    urlWithParams.searchParams.append('id', id);
    urlWithParams.searchParams.append('action', action);
    if (actionDate) {
      urlWithParams.searchParams.append('actionDate', actionDate);
    }

    const response = await fetch(urlWithParams.toString(), {
      method: "GET"
    });
    
    const result = await response.json();
    return result.success;
  } catch (error: any) {
    console.error("Failed to update status:", error);
    alert("เกิดข้อผิดพลาด: " + error.message);
    return false;
  }
}

export async function editExistingLoan(id: string, editData: {
  principal: number;
  dueDate: string; // dd/MM/yyyy
  daysBorrowed: number;
  interestRate: number;
}): Promise<boolean> {
  if (!GOOGLE_SCRIPT_WEB_APP_URL) {
    return false;
  }

  try {
    const urlWithParams = new URL(GOOGLE_SCRIPT_WEB_APP_URL);
    urlWithParams.searchParams.append('id', id);
    urlWithParams.searchParams.append('action', 'EDIT_LOAN');
    urlWithParams.searchParams.append('principal', editData.principal.toString());
    urlWithParams.searchParams.append('dueDate', editData.dueDate);
    urlWithParams.searchParams.append('daysBorrowed', editData.daysBorrowed.toString());
    urlWithParams.searchParams.append('interestRate', editData.interestRate.toString());

    const response = await fetch(urlWithParams.toString(), {
      method: "GET"
    });
    
    const result = await response.json();
    return result.success;
  } catch (error: any) {
    console.error("Failed to edit loan:", error);
    alert("เกิดข้อผิดพลาดในการแก้ไขข้อมูล: " + error.message);
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
