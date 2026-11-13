import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fetchAppData, AppData, LoanRecord, updateLoanStatus, createNewLoan, editExistingLoan, fetchCapital, saveCapital, computeSummary, DEFAULT_CAPITAL, CapitalConfig, DEFAULT_REMINDER, fetchReminderTemplate, saveReminderTemplate, renderReminder } from './services/dataService';
import { formatCurrency, parseThaiDate } from './lib/utils';
import { ResponsiveContainer, Tooltip as RechartsTooltip, Legend, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush, getNotificationPermission, sendTestNotification } from './services/pushService';
import { t, Lang } from './lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { House, HandCoins, ChartLineUp, User, Plus, X, ArrowClockwise, PencilSimple, CaretRight, Bell, BellSlash, ChatCircleText, Copy, MessengerLogo } from '@phosphor-icons/react';


// ─────────────────────────────────────────────────────────────
// App — root component (SPA ไฟล์เดียว)
//
// Layout:
//   Desktop (≥768px) = sidebar ซ้าย + main area 3 ส่วน
//   Mobile           = bottom nav 4 tabs (dashboard / loans / analytics / you)
//
// Data flow:
//   Google Sheets (CSV) → /api/data proxy (server.ts) → fetchAppData() → state
//   การแก้ไข (ชำระ/ต่อดอก/สร้างใหม่) → Google Apps Script Web App URL
//   Refresh อัตโนมัติทุก 2 นาที + manual sync button
//
// ไม่มี global store — state ทั้งหมดอยู่ใน component นี้
// ─────────────────────────────────────────────────────────────
export default function App() {
  // ── DATA STATE ────────────────────────────────────────────────
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  // ทุนตั้งต้น — โหลดจาก /api/capital (Vercel KV) ปรับได้จากปุ่ม "เช็คกับบัญชีจริง"
  const [capitalCfg, setCapitalCfg] = useState<CapitalConfig>({ capital: DEFAULT_CAPITAL });
  const capitalRef = React.useRef(DEFAULT_CAPITAL);
  const CAPITAL = capitalCfg.capital;
  const [showReconcile, setShowReconcile] = useState(false);
  const [bankInput, setBankInput] = useState('');
  const [isSavingCapital, setIsSavingCapital] = useState(false);
  // ทวงหนี้
  const [reminderTemplate, setReminderTemplate] = useState<string>(DEFAULT_REMINDER);
  const [reminderLoan, setReminderLoan] = useState<LoanRecord | null>(null);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  // ── UI STATE ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'all' | 'renewals' | 'paid' | 'defaulted' | 'withdrawn' | 'raw'>('all');
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [insightDate, setInsightDate] = useState<string | null>(null);
  const [showExpandedTrend, setShowExpandedTrend] = useState(false);
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'th');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'amount-desc' | 'amount-asc' | 'overdue' | 'name'>('default');
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showConfirmDefault, setShowConfirmDefault] = useState(false);
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [showReserveBreakdown, setShowReserveBreakdown] = useState(false);
  const [showWeeklySheet, setShowWeeklySheet] = useState(false);
  const [hasPenalty, setHasPenalty] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState(200);
  type MobileTab = 'dashboard' | 'loans' | 'analytics' | 'you';
  const TABS: MobileTab[] = ['dashboard', 'loans', 'analytics', 'you'];
  const tabFromHash = (): MobileTab => {
    const h = (typeof window !== 'undefined' ? window.location.hash.slice(1) : '') as MobileTab;
    return TABS.includes(h) ? h : 'dashboard';
  };
  const [activeMobileTab, setActiveMobileTabState] = useState<MobileTab>(tabFromHash);
  // แท็บอยู่ใน URL (#loans) — รีเฟรชแล้วอยู่แท็บเดิม ปุ่ม back ย้อนแท็บได้
  const setActiveMobileTab = (tab: MobileTab) => {
    setActiveMobileTabState(tab);
    const next = tab === 'dashboard' ? window.location.pathname : '#' + tab;
    if ((window.location.hash || '') !== (tab === 'dashboard' ? '' : '#' + tab)) window.history.pushState(null, '', next);
  };
  useEffect(() => {
    const onPop = () => setActiveMobileTabState(tabFromHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [showPortfolioLine2, setShowPortfolioLine2] = useState(false);
  const [showPortfolioLine3, setShowPortfolioLine3] = useState(false);
  const [portfolioTimeframe, setPortfolioTimeframe] = useState<'1W' | '1M' | '3M' | '6M' | 'all'>('3M');
  const [portfolioTooltipIdx, setPortfolioTooltipIdx] = useState<number | null>(null);
  const portfolioChartRef = React.useRef<HTMLDivElement | null>(null);
  const portfolioScrollPos = React.useRef(-1); // -1 = scroll to rightmost end
  // Callback ref: restores saved scroll position (or scrolls to end) on every mount/remount
  const portfolioChartCallbackRef = React.useCallback((el: HTMLDivElement | null) => {
    portfolioChartRef.current = el;
    if (el) el.scrollLeft = portfolioScrollPos.current < 0 ? el.scrollWidth : portfolioScrollPos.current;
  }, []);

  // ── RESPONSIVE BREAKPOINT ─────────────────────────────────────
  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  const toggleLang = () => {
    setLang(l => { const next = l === 'th' ? 'en' : 'th'; localStorage.setItem('lang', next); return next; });
  };
  const [withdrawForm, setWithdrawForm] = useState({
    name: '',
    principal: '',
    date: new Date()
  });

  const [actionDate, setActionDate] = useState<Date>(new Date());
  const [renewStartDate, setRenewStartDate] = useState<Date>(new Date());
  const [isEditingLoan, setIsEditingLoan] = useState(false);
  const [editLoanForm, setEditLoanForm] = useState({
    principal: '500',
    borrowDate: new Date(),
    dueDate: new Date(),
    daysBorrowed: 7,
    interestRate: 35,
    expectedInterest: 175
  });

  // ── FORM STATE ────────────────────────────────────────────────
  // Reset states when selected loan changes
  useEffect(() => {
    setIsEditingLoan(false);
    setActionDate(new Date());
    setRenewStartDate(new Date());
    setHasPenalty(false);
    if (selectedLoan) {
      setPenaltyAmount(selectedLoan.daysLate > 0 ? selectedLoan.daysLate * 200 : 200);
      const parts = selectedLoan.dueDate.split('/');
      const dDate = parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])) : new Date();
      const bParts = selectedLoan.borrowDate.split('/');
      const bDate = bParts.length === 3 ? new Date(parseInt(bParts[2]), parseInt(bParts[1]) - 1, parseInt(bParts[0])) : new Date();
      setEditLoanForm({
        principal: selectedLoan.principal.toString(),
        borrowDate: bDate,
        dueDate: dDate,
        daysBorrowed: selectedLoan.daysBorrowed || 7,
        interestRate: selectedLoan.interestRate || 20,
        expectedInterest: selectedLoan.expectedInterest
      });
    }
  }, [selectedLoan]);

  const [newLoanForm, setNewLoanForm] = useState({
    name: '',
    principal: '500',
    borrowDate: new Date(),
    dueDate: new Date(Date.now() + 7 * 86400000),
    daysBorrowed: 7,
    interestRate: 35,
    note: ''
  });

  const handleBorrowDateChange = (date: Date | null) => {
    if (!date) return;
    const dDate = new Date(date.getTime() + newLoanForm.daysBorrowed * 86400000);
    setNewLoanForm(f => ({ ...f, borrowDate: date, dueDate: dDate }));
  };

  const handleDueDateChange = (date: Date | null) => {
    if (!date) return;
    const bDate = newLoanForm.borrowDate;
    const diffTime = date.getTime() - bDate.getTime();
    const days = Math.max(1, Math.ceil(diffTime / 86400000));
    setNewLoanForm(f => ({ ...f, dueDate: date, daysBorrowed: days, interestRate: days * 5 }));
  };

  const handleDaysChange = (val: number) => {
    const days = Math.max(1, val);
    const bDate = newLoanForm.borrowDate;
    const dDate = new Date(bDate.getTime() + days * 86400000);
    setNewLoanForm(f => ({ ...f, daysBorrowed: days, dueDate: dDate, interestRate: days * 5 }));
  };

  const handleEditDueDateChange = (date: Date | null) => {
    if (!date) return;
    const bDate = editLoanForm.borrowDate;
    const diffTime = date.getTime() - bDate.getTime();
    const days = Math.max(1, Math.ceil(diffTime / 86400000));
    setEditLoanForm(f => ({ ...f, dueDate: date, daysBorrowed: days, interestRate: days * 5 }));
  };

  const handleEditDaysChange = (val: number) => {
    const days = Math.max(1, val);
    const bDate = editLoanForm.borrowDate;
    const dDate = new Date(bDate.getTime() + days * 86400000);
    setEditLoanForm(f => ({ ...f, daysBorrowed: days, dueDate: dDate, interestRate: days * 5 }));
  };

  const formatToThaiStr = (dateObj: Date) => {
    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
  };

  const [dueListRef] = useAutoAnimate<HTMLDivElement>();
  const [overdueListRef] = useAutoAnimate<HTMLDivElement>();
  const [tableRef] = useAutoAnimate<HTMLTableSectionElement>();

  // ── COMPUTED VALUES ────────────────────────────────────────────
  // useMemo ทุกตัวด้านล่างจะคำนวณใหม่เมื่อ data หรือ deps เปลี่ยนเท่านั้น

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // รายการที่ครบกำหนดวันนี้ (ใช้แสดงบนแดชบอร์ดและ document title)
  const dueTodayLoans = useMemo(() => {
    if (!data) return [];
    return data.loans.filter(l => {
      if (l.isPaid || l.isScam || l.isRenewed || l.isWithdrawn) return false;
      const parsed = parseThaiDate(l.dueDate);
      return parsed && parsed.getTime() === today.getTime();
    });
  }, [data, today]);

  const overdueLoans = useMemo(() =>
    data ? data.loans.filter(l => l.isOverdue && !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn) : [],
  [data]);

  const activeLoansCount = useMemo(() =>
    data ? data.loans.filter(l => !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn).length : 0,
  [data]);

  // รายการที่แสดงในตาราง — กรองตาม tab + search + sort
  const filteredLoans = useMemo(() => {
    if (!data) return [];
    let loans = data.loans.filter(l => {
      if (activeTab === 'all') return !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn;
      if (activeTab === 'renewals') return l.isRenewed;
      if (activeTab === 'paid') return l.isPaid;
      if (activeTab === 'defaulted') return l.isScam;
      if (activeTab === 'withdrawn') return l.isWithdrawn;
      return true;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      loans = loans.filter(l => l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'amount-desc': return [...loans].sort((a, b) => b.principal - a.principal);
      case 'amount-asc':  return [...loans].sort((a, b) => a.principal - b.principal);
      case 'overdue':     return [...loans].sort((a, b) => b.daysLate - a.daysLate);
      case 'name':        return [...loans].sort((a, b) => a.name.localeCompare(b.name, 'th'));
      default:            return loans;
    }
  }, [data, activeTab, searchQuery, sortBy]);

  const tabCounts = useMemo(() => {
    if (!data) return { all: 0, renewals: 0, paid: 0, defaulted: 0, withdrawn: 0, raw: 0 };
    return {
      all: data.loans.filter(l => !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn).length,
      renewals: data.loans.filter(l => l.isRenewed).length,
      paid: data.loans.filter(l => l.isPaid).length,
      defaulted: data.loans.filter(l => l.isScam).length,
      withdrawn: data.loans.filter(l => l.isWithdrawn).length,
      raw: data.loans.length
    };
  }, [data]);

  // Cashflow trend: จัดกลุ่มดอกตามวันครบกำหนดและวันที่จ่ายจริง (14/30 วัน)
  const { trendData14, trendData30, labelToFullDate } = useMemo(() => {
    if (!data) return { trendData14: [], trendData30: [], labelToFullDate: new Map<string, string>() };

    const dateMap: Record<string, { expected: number; actual: number }> = {};
    const allDates = new Set<string>();
    data.loans.forEach(l => {
      if (l.dueDate && parseThaiDate(l.dueDate)) {
        allDates.add(l.dueDate);
        if (!dateMap[l.dueDate]) dateMap[l.dueDate] = { expected: 0, actual: 0 };
        dateMap[l.dueDate].expected += l.expectedInterest;
      }
      if (l.actualDate && parseThaiDate(l.actualDate)) {
        allDates.add(l.actualDate);
        if (!dateMap[l.actualDate]) dateMap[l.actualDate] = { expected: 0, actual: 0 };
        dateMap[l.actualDate].actual += l.paidInterest;
      }
    });
    const sortedDates = Array.from(allDates).sort((a, b) => parseThaiDate(a)!.getTime() - parseThaiDate(b)!.getTime());
    const labelToFullDate = new Map<string, string>(sortedDates.map(d => [d.substring(0, 5), d]));
    const trendData14 = sortedDates.slice(-14).map(date => ({ date: date.substring(0, 5), value: dateMap[date].actual, Expected: dateMap[date].expected, Received: dateMap[date].actual }));
    const trendData30 = sortedDates.slice(-30).map(date => ({ date: date.substring(0, 5), value: dateMap[date].actual, Expected: dateMap[date].expected, Received: dateMap[date].actual }));
    return { trendData14, trendData30, labelToFullDate };
  }, [data]);

  const portfolioTrend = useMemo(() => {
    if (!data) return [];
    const result: { date: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      d.setHours(0, 0, 0, 0);
      const portfolio = data.loans.reduce((sum, l) => {
        const bDate = parseThaiDate(l.borrowDate);
        if (!bDate) return sum;
        const rawEnd = l.actualDate || l.dueDate;
        const eDate = rawEnd ? parseThaiDate(rawEnd) : null;
        if (bDate.getTime() <= d.getTime() && (!eDate || d.getTime() <= eDate.getTime())) {
          return sum + l.principal;
        }
        return sum;
      }, 0);
      result.push({ date: `${d.getDate()}/${d.getMonth() + 1}`, value: portfolio });
    }
    return result;
  }, [data, today]);

  // สรุปรายเดือน: ดอกที่เก็บได้, หนี้เสีย, เบิก — ใช้ใน analytics
  const monthlySummary = useMemo(() => {
    if (!data) return [];
    const months: Record<string, { interest: number; scam: number; withdrawn: number; count: number; month: number; year: number }> = {};
    const getOrCreate = (key: string, month: number, year: number) => {
      if (!months[key]) months[key] = { interest: 0, scam: 0, withdrawn: 0, count: 0, month, year };
      return months[key];
    };
    data.loans.forEach(l => {
      if ((l.isPaid || l.isRenewed) && l.actualDate) {
        const parsed = parseThaiDate(l.actualDate);
        if (!parsed) return;
        const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
        const e = getOrCreate(key, parsed.getMonth(), parsed.getFullYear());
        e.interest += l.paidInterest;
        e.count += 1;
      }
      if (l.isScam) {
        const dateStr = l.actualDate || l.dueDate;
        const parsed = parseThaiDate(dateStr);
        if (!parsed) return;
        const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
        getOrCreate(key, parsed.getMonth(), parsed.getFullYear()).scam += l.principal;
      }
      if (l.isWithdrawn) {
        const parsed = parseThaiDate(l.borrowDate);
        if (!parsed) return;
        const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
        getOrCreate(key, parsed.getMonth(), parsed.getFullYear()).withdrawn += l.principal;
      }
    });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => ({ key, ...val }));
  }, [data]);

  // สรุปรายสัปดาห์ (จันทร์–อาทิตย์) — ใช้ใน weekly sheet modal
  const weeklySummary = useMemo(() => {
    if (!data) return [];
    const getMonKey = (d: Date): string => {
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const m = new Date(d);
      m.setDate(d.getDate() + diff);
      return `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}-${String(m.getDate()).padStart(2,'0')}`;
    };
    const weeks: Record<string, { interest: number; scam: number; withdrawn: number; count: number }> = {};
    const bump = (key: string) => { if (!weeks[key]) weeks[key] = { interest: 0, scam: 0, withdrawn: 0, count: 0 }; return weeks[key]; };
    data.loans.forEach(l => {
      if ((l.isPaid || l.isRenewed) && l.actualDate) {
        const p = parseThaiDate(l.actualDate); if (!p) return;
        const e = bump(getMonKey(p)); e.interest += l.paidInterest; e.count += 1;
      }
      if (l.isScam) {
        const p = parseThaiDate(l.actualDate || l.dueDate); if (!p) return;
        bump(getMonKey(p)).scam += l.principal;
      }
      if (l.isWithdrawn) {
        const p = parseThaiDate(l.borrowDate); if (!p) return;
        bump(getMonKey(p)).withdrawn += l.principal;
      }
    });
    const thisKey = getMonKey(new Date());
    return Object.entries(weeks)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => ({ key, ...val, isCurrentWeek: key === thisKey }));
  }, [data]);

  // สถิติต่อคน: จำนวนต่อดอก, ดอกสะสม, มี active/scam — ใช้ loyalty tier
  const borrowerStats = useMemo(() => {
    if (!data) return [];
    const map: Record<string, { name: string; totalRenewals: number; totalEarned: number; hasActive: boolean; hasScam: boolean }> = {};
    data.loans.forEach(l => {
      if (!map[l.name]) map[l.name] = { name: l.name, totalRenewals: 0, totalEarned: 0, hasActive: false, hasScam: false };
      if (l.isRenewed) map[l.name].totalRenewals++;
      if (l.isPaid || l.isRenewed) map[l.name].totalEarned += l.paidInterest;
      if (l.isScam) map[l.name].hasScam = true;
      if (!l.isPaid && !l.isScam && !l.isWithdrawn && !l.isRenewed) map[l.name].hasActive = true;
    });
    return Object.values(map).sort((a, b) => b.totalRenewals - a.totalRenewals);
  }, [data]);

  const allBorrowerNames = useMemo(() =>
    [...new Set(data?.loans.map(l => l.name) ?? [])].sort()
  , [data]);

  // ดอกสำรอง: คำนวณว่า "ยอดว่าง" จริงๆ เบิกได้เท่าไหน
  //   locked = ดอกสะสมที่ยังไม่ถึงต้น (ต้องสำรองไว้กันความเสี่ยง)
  //   safeWithdrawable = available - totalLocked
  //   scamItems = ประวัติหนี้เสียพร้อมดอกที่ดูดซับความเสียหายได้
  const reserveData = useMemo(() => {
    if (!data) return { totalLocked: 0, safeWithdrawable: 0, items: [] };
    const latestByName: Record<string, typeof data.loans[0]> = {};
    data.loans.forEach(l => {
      // เฉพาะ row active ปัจจุบัน: ไม่ใช่ paid/scam/withdrawn/renewed + มีประวัติต่อดอก
      if (!l.isPaid && !l.isScam && !l.isWithdrawn && !l.isRenewed && l.historicalRenewalCount > 0) {
        if (!latestByName[l.name] || l.historicalRenewalCount >= latestByName[l.name].historicalRenewalCount) {
          latestByName[l.name] = l;
        }
      }
    });
    const items = Object.values(latestByName).map(l => {
      const isBreakEven = l.historicalRenewalInterest >= l.principal;
      // locked = principal ที่ยังต้องสำรองไว้จนกว่าจะปิดยอด (max = principal)
      const locked = Math.min(l.historicalRenewalInterest, l.principal);
      // ส่วนเกินจาก principal = เบิกได้แล้ว
      const excess = Math.max(0, l.historicalRenewalInterest - l.principal);
      const recoveryPct = Math.min(100, (l.historicalRenewalInterest / l.principal) * 100);
      const remaining = Math.max(0, l.principal - l.historicalRenewalInterest);
      const renewalsNeeded = l.expectedInterest > 0 ? Math.ceil(remaining / l.expectedInterest) : 0;
      const approxDaysRenewing = l.historicalRenewalCount * (l.daysBorrowed || 7);
      const isLongTerm = approxDaysRenewing > 180;
      return { loan: l, locked, excess, recoveryPct, remaining, renewalsNeeded, isBreakEven, isLongTerm, approxDaysRenewing };
    }).sort((a, b) => {
      if (a.isBreakEven !== b.isBreakEven) return a.isBreakEven ? 1 : -1;
      if (!a.isBreakEven) return a.recoveryPct - b.recoveryPct; // เสี่ยงสุดขึ้นก่อน
      return b.excess - a.excess; // กลุ่มปลอดภัย: เกินมากขึ้นก่อน
    });
    const totalLocked = items.reduce((s, i) => s + i.locked, 0);
    const safeWithdrawable = Math.max(0, data.summary.available - totalLocked);
    const totalInterestCollected = items.reduce((s, i) => s + i.loan.historicalRenewalInterest, 0);
    const totalPrincipalAtRisk = items.reduce((s, i) => s + i.loan.principal, 0);
    const coverageRatio = totalPrincipalAtRisk > 0 ? (totalInterestCollected / totalPrincipalAtRisk) * 100 : 0;

    // ประวัติหนี้เสีย — scam loans พร้อมดอกที่ดูดซับได้
    const scamItems = data.loans
      .filter(l => l.isScam)
      .map(l => ({
        name: l.name,
        id: l.id,
        principal: l.principal,
        interestAbsorbed: l.historicalRenewalInterest,
        renewalCount: l.historicalRenewalCount,
        netLoss: l.principal - l.historicalRenewalInterest,
      }));
    const totalScamPrincipal = scamItems.reduce((s, i) => s + i.principal, 0);
    const totalInterestAbsorbed = scamItems.reduce((s, i) => s + i.interestAbsorbed, 0);
    const totalNetLoss = totalScamPrincipal - totalInterestAbsorbed;

    return { totalLocked, safeWithdrawable, items, coverageRatio, scamItems, totalScamPrincipal, totalInterestAbsorbed, totalNetLoss };
  }, [data]);

  // Portfolio growth chart: historical + forecast line
  //   historical = running total จากดอกจริง/scam/เบิก ตามลำดับวันที่
  //   forecast   = ต่อจาก historical ด้วยดอกที่คาดว่าจะได้จาก active loans
  const portfolioGrowthData = useMemo(() => {
    if (!data) return [];
    const INITIAL = CAPITAL;

    type DayEv = { earned: number; scam: number; withdrawn: number; wNames: string[]; sNames: string[] };
    const byMs = new Map<number, DayEv & { label: string }>();
    const getDay = (ms: number) => {
      if (!byMs.has(ms)) {
        const d = new Date(ms);
        byMs.set(ms, { earned: 0, scam: 0, withdrawn: 0, wNames: [], sNames: [], label: `${d.getDate()}/${d.getMonth() + 1}` });
      }
      return byMs.get(ms)!;
    };

    // Priority order must match dataService.ts summary loop exactly
    data.loans.forEach(l => {
      if (l.isWithdrawn) {
        const p = parseThaiDate(l.actualDate || l.borrowDate); if (!p) return;
        const ev = getDay(p.getTime()); ev.withdrawn += l.principal; ev.wNames.push(l.name);
      } else if (l.isScam) {
        const p = parseThaiDate(l.actualDate || l.dueDate); if (!p) return;
        const ev = getDay(p.getTime()); ev.scam += l.principal; ev.sNames.push(l.name);
      } else if (l.isPaid || l.isRenewed) {
        const p = parseThaiDate(l.actualDate || l.dueDate); if (!p) return;
        getDay(p.getTime()).earned += l.paidInterest;
      }
    });

    const sortedMs = Array.from(byMs.keys()).sort((a, b) => a - b);
    let runPortfolio = INITIAL, runGross = INITIAL, runInterest = 0;

    const historical = sortedMs.map(ms => {
      const ev = byMs.get(ms)!;
      runPortfolio += ev.earned - ev.scam - ev.withdrawn;
      runGross += ev.earned - ev.scam;
      runInterest += ev.earned - ev.scam;
      return {
        ms, date: ev.label,
        portfolio: runPortfolio, portfolioF: undefined as number | undefined,
        gross: runGross, grossF: undefined as number | undefined,
        interest: runInterest, interestF: undefined as number | undefined,
        hasW: ev.withdrawn > 0, hasS: ev.scam > 0,
        earned: ev.earned, scam: ev.scam, withdrawn: ev.withdrawn,
        wNames: ev.wNames, sNames: ev.sNames,
        isForecast: false,
      };
    });

    const fcByMs = new Map<number, { label: string; exp: number; names: string[] }>();
    data.loans.forEach(l => {
      if (l.isPaid || l.isScam || l.isWithdrawn || l.isRenewed) return;
      const p = parseThaiDate(l.dueDate);
      if (!p || p.getTime() <= today.getTime()) return;
      if (!fcByMs.has(p.getTime())) {
        const d = p; fcByMs.set(p.getTime(), { label: `${d.getDate()}/${d.getMonth() + 1}`, exp: 0, names: [] });
      }
      const ev = fcByMs.get(p.getTime())!; ev.exp += l.expectedInterest; ev.names.push(l.name);
    });

    const fcMs = Array.from(fcByMs.keys()).sort((a, b) => a - b);
    let fcP = runPortfolio, fcG = runGross, fcI = runInterest;

    if (historical.length > 0 && fcMs.length > 0) {
      const last = historical[historical.length - 1];
      last.portfolioF = last.portfolio; last.grossF = last.gross; last.interestF = last.interest;
    }

    const forecast = fcMs.map(ms => {
      const ev = fcByMs.get(ms)!;
      fcP += ev.exp; fcG += ev.exp; fcI += ev.exp;
      return {
        ms, date: ev.label,
        portfolio: undefined as number | undefined, portfolioF: fcP,
        gross: undefined as number | undefined, grossF: fcG,
        interest: undefined as number | undefined, interestF: fcI,
        hasW: false, hasS: false,
        earned: ev.exp, scam: 0, withdrawn: 0,
        wNames: [] as string[], sNames: [] as string[], names: ev.names,
        isForecast: true,
      };
    });

    return [...historical, ...forecast];
  }, [data, today, CAPITAL]);

  const filteredPortfolioData = useMemo(() => {
    const days = portfolioTimeframe === '1W' ? 7 : portfolioTimeframe === '1M' ? 30 : portfolioTimeframe === '3M' ? 90 : portfolioTimeframe === '6M' ? 180 : Infinity;
    if (!isFinite(days)) return portfolioGrowthData;
    const cutoffMs = Date.now() - days * 86400000;
    // keep all forecast points + historical points within the window
    return portfolioGrowthData.filter(p => p.ms >= cutoffMs || p.isForecast);
  }, [portfolioGrowthData, portfolioTimeframe]);

  // When data/timeframe changes, reset to "scroll to end" and apply immediately
  useLayoutEffect(() => {
    portfolioScrollPos.current = -1;
    const el = portfolioChartRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [filteredPortfolioData]);

  const loadData = async (quiet = false) => {
    if (!quiet) setIsSyncing(true);
    try {
      const newData = await fetchAppData(capitalRef.current);
      if (newData) { setData(newData); setLastSynced(new Date()); }
    } catch (e) {
      console.error(e);
      showToast('ไม่สามารถเชื่อมต่อดึงข้อมูลล่าสุดได้', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // ── RECONCILE: ทำให้ "เงินในบัญชี" ในแอปตรงกับยอดธนาคารจริง ──
  //   ทุนใหม่ = ทุนเดิม + (ยอดธนาคารจริง − เงินในบัญชีที่แอปคำนวณ)
  //   กำไรไม่หาย เพราะปรับที่ทุน ไม่ได้แก้รายการกู้
  const openReconcile = () => {
    setBankInput(data ? String(Math.round(data.summary.available)) : '');
    setShowReconcile(true);
  };

  const applyReconcile = async () => {
    if (!data) return;
    const bank = parseFloat(bankInput.replace(/,/g, ''));
    if (!Number.isFinite(bank) || bank < 0) {
      showToast(lang === 'th' ? 'กรอกยอดเงินในบัญชีเป็นตัวเลข' : 'Enter your bank balance as a number', 'error');
      return;
    }
    const newCapital = Math.round(CAPITAL + (bank - data.summary.available));
    if (newCapital <= 0) {
      showToast(lang === 'th' ? 'ยอดนี้ทำให้ทุนติดลบ ตรวจรายการกู้อีกครั้ง' : 'This balance makes capital negative. Check your loan records.', 'error');
      return;
    }
    setIsSavingCapital(true);
    const saved = await saveCapital(newCapital, bank);
    setIsSavingCapital(false);
    if (!saved) {
      showToast(lang === 'th' ? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' : 'Could not save. Try again.', 'error');
      return;
    }
    capitalRef.current = saved.capital;
    setCapitalCfg(saved);
    setData(d => d ? { ...d, summary: computeSummary(d.loans, saved.capital) } : d);
    setShowReconcile(false);
    showToast(lang === 'th' ? `ปรับแล้ว เงินในบัญชี ${formatCurrency(bank)}` : `Updated. Cash in account ${formatCurrency(bank)}`);
  };

  const navIcon = (name: string, active: boolean, size: number) => {
    const w = active ? 'fill' : 'regular';
    if (name === 'dashboard') return <House size={size} weight={w} aria-hidden="true" />;
    if (name === 'loans') return <HandCoins size={size} weight={w} aria-hidden="true" />;
    if (name === 'analytics') return <ChartLineUp size={size} weight={active ? 'bold' : 'regular'} aria-hidden="true" />;
    if (name === 'you') return <User size={size} weight={w} aria-hidden="true" />;
    return <Plus size={size} weight="bold" aria-hidden="true" />;
  };

  // ทำให้ div/span/tr ที่กดได้ ใช้คีย์บอร์ดได้ด้วย (Enter / Space)
  const tap = (fn?: ((e?: any) => void) | null) => fn ? ({
    onClick: fn,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } },
    role: 'button' as const,
    tabIndex: 0,
  }) : {};

  const reminderText = reminderLoan ? renderReminder(reminderTemplate, reminderLoan) : '';

  const copyReminder = async () => {
    try {
      await navigator.clipboard.writeText(reminderText);
      showToast(lang === 'th' ? 'คัดลอกแล้ว วางในแชทได้เลย' : 'Copied. Paste it in the chat.');
    } catch {
      showToast(lang === 'th' ? 'คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง' : 'Copy failed. Long press the text to copy it.', 'error');
    }
  };

  // Messenger ไม่รับข้อความผ่านลิงก์ → คัดลอกไว้ก่อน แล้วเปิดเมนูแชร์ของเครื่อง (เลือก Messenger ได้ ข้อความติดไปด้วย)
  //   เครื่องที่ไม่มีเมนูแชร์ (คอม) → เปิด Messenger ให้วางเอง
  const shareReminderMessenger = async () => {
    try { await navigator.clipboard.writeText(reminderText); } catch {}
    if (navigator.share) {
      try { await navigator.share({ text: reminderText }); return; }
      catch (e: any) { if (e?.name === 'AbortError') return; }
    }
    window.open('https://www.messenger.com/', '_blank', 'noopener');
    showToast(lang === 'th' ? 'คัดลอกแล้ว เปิดแชทแล้ววางได้เลย' : 'Copied. Open the chat and paste.');
  };

  const openTemplateEditor = () => {
    setTemplateDraft(reminderTemplate);
    setEditingTemplate(true);
  };

  const saveTemplate = async () => {
    const t = templateDraft.trim();
    if (!t) { showToast(lang === 'th' ? 'ข้อความว่างอยู่' : 'Message is empty', 'error'); return; }
    setIsSavingTemplate(true);
    const ok = await saveReminderTemplate(t);
    setIsSavingTemplate(false);
    if (!ok) { showToast(lang === 'th' ? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' : 'Could not save. Try again.', 'error'); return; }
    setReminderTemplate(t);
    setEditingTemplate(false);
    showToast(lang === 'th' ? 'บันทึกข้อความทวงหนี้แล้ว' : 'Reminder message saved');
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── ACTION HANDLERS ───────────────────────────────────────────

  // สร้างลูกหนี้ใหม่ → POST ไปยัง Google Apps Script แล้ว refresh data หลัง 2.5 วิ
  // อัปเดตรายการกู้บนจอทันที + คำนวณสรุปยอดใหม่ (เงินในบัญชี/กำไร) ไม่ต้องรอรีเฟรช
  const applyLoans = (loans: LoanRecord[]) =>
    setData(d => d ? { ...d, loans, summary: computeSummary(loans, capitalRef.current) } : d);

  const makeLocalLoan = (fields: Partial<LoanRecord>): LoanRecord => ({
    id: 'N' + Date.now().toString().slice(-6), name: '', principal: 0, borrowDate: '', dueDate: '', actualDate: '',
    daysBorrowed: 0, daysLate: 0, interestRate: 0, expectedInterest: 0, penalty: 0, totalExpected: 0,
    status: 'ยังไม่ชำระ', paidAmount: 0, paidPrincipal: 0, paidInterest: 0,
    isPaid: false, isOverdue: false, isScam: false, isRenewed: false, isWithdrawn: false,
    historicalRenewalInterest: 0, historicalRenewalCount: 0, penaltyHistory: [], note: '',
    ...fields,
  } as LoanRecord);

  const handleCreateNewLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoanForm.name || !newLoanForm.principal) return;

    setIsSyncing(true);
    const pValue = parseFloat(newLoanForm.principal);

    try {
      const res = await createNewLoan({
        name: newLoanForm.name,
        principal: pValue,
        borrowDate: formatToThaiStr(newLoanForm.borrowDate),
        dueDate: formatToThaiStr(newLoanForm.dueDate),
        daysBorrowed: newLoanForm.daysBorrowed,
        interestRate: newLoanForm.interestRate,
        note: newLoanForm.note || undefined
      });

      if (res.success) {
        if (data) {
          const interest = Math.round(pValue * newLoanForm.interestRate / 100);
          applyLoans([...data.loans, makeLocalLoan({
            name: newLoanForm.name, principal: pValue,
            borrowDate: formatToThaiStr(newLoanForm.borrowDate), dueDate: formatToThaiStr(newLoanForm.dueDate),
            daysBorrowed: newLoanForm.daysBorrowed, interestRate: newLoanForm.interestRate,
            expectedInterest: interest, totalExpected: pValue + interest, note: newLoanForm.note || '',
          })]);
        }
        showToast(t('loanAddedSuccess', lang), 'success');
        setShowNewLoanModal(false);
        setNewLoanForm({ ...newLoanForm, name: '', principal: '500' });
        setTimeout(() => loadData(true), 2500);
      } else {
        throw new Error("API returned failure");
      }
    } catch (err) {
      console.error(err);
      showToast(t('loanAddedFailed', lang), 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // บันทึกการเบิกเงิน → ใช้ createNewLoan เดียวกัน แต่ status = "เบิก"
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawForm.principal) return;

    setIsSyncing(true);
    const pValue = parseFloat(withdrawForm.principal);
    const name = withdrawForm.name.trim() || "เบิก";

    try {
      const res = await createNewLoan({
        name: name,
        principal: pValue,
        borrowDate: formatToThaiStr(withdrawForm.date),
        dueDate: formatToThaiStr(withdrawForm.date), // ไม่สำคัญสำหรับเบิก
        daysBorrowed: 0,
        interestRate: 0,
        status: "เบิก"
      });

      if (res.success) {
        if (data) {
          const d = formatToThaiStr(withdrawForm.date);
          applyLoans([...data.loans, makeLocalLoan({
            name, principal: pValue, borrowDate: d, dueDate: d, actualDate: d,
            status: 'เบิก', isWithdrawn: true, totalExpected: pValue,
          })]);
        }
        showToast(t('withdrawalSuccess', lang), 'success');
        setShowWithdrawModal(false);
        setWithdrawForm({ name: '', principal: '', date: new Date() });
        setTimeout(() => loadData(true), 2500);
      } else {
        throw new Error("API returned failure");
      }
    } catch (err) {
      console.error(err);
      showToast(t('withdrawalFailed', lang), 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // อัปเดตสถานะ loan: ชำระแล้ว / ต่อดอก / โดนบิด
  //   Optimistic update: อัปเดต UI ทันที ไม่รอ API
  //   ถ้า API ล้มเหลว: rollback state และแสดง toast error
  const handleUpdateStatus = async (action: 'ชำระแล้ว' | 'ต่อดอก' | 'โดนบิด') => {
    if (!selectedLoan || !data) return;

    const formattedActionDate = formatToThaiStr(actionDate);

    // ปิดหน้าต่างทันทีเพื่อความลื่นไหล
    const currentLoan = { ...selectedLoan };
    setSelectedLoan(null);
    setIsSyncing(true);

    // 1. Optimistic Update: อัปเดตข้อมูลบนหน้าจอทันที (จำลอง)
    const updatedLoans = [...data.loans];
    const loanIndex = updatedLoans.findIndex(l => l.id === currentLoan.id);

    if (loanIndex > -1) {
      const targetLoan = { ...updatedLoans[loanIndex] };

      const pen = hasPenalty ? penaltyAmount : 0;
      targetLoan.actualDate = formattedActionDate;
      if (action === 'ชำระแล้ว') {
        targetLoan.isPaid = true;
        targetLoan.isOverdue = false;
        targetLoan.status = "ชำระแล้ว";
        targetLoan.penalty = pen;
        targetLoan.paidPrincipal = targetLoan.principal;
        targetLoan.paidInterest = targetLoan.expectedInterest + pen;
        targetLoan.paidAmount = targetLoan.principal + targetLoan.expectedInterest + pen;
      } else if (action === 'โดนบิด') {
        targetLoan.isScam = true;
        targetLoan.status = "โดนบิด";
      } else if (action === 'ต่อดอก') {
        targetLoan.isRenewed = true;
        targetLoan.isOverdue = false;
        targetLoan.status = "ต่อดอก";
        targetLoan.penalty = pen;
        targetLoan.paidInterest = targetLoan.expectedInterest + pen;
        targetLoan.paidAmount = targetLoan.expectedInterest + pen;

        // สร้างรายการจำลองขึ้นมาใหม่
        const newLoan = { ...targetLoan };
        newLoan.id = 'R' + Date.now().toString().slice(-6);
        newLoan.isRenewed = false;
        newLoan.isPaid = false;
        newLoan.isScam = false;
        newLoan.isOverdue = false;
        newLoan.isWithdrawn = false;
        newLoan.status = "ยังไม่ชำระ";
        newLoan.penalty = 0; newLoan.paidAmount = 0; newLoan.paidPrincipal = 0; newLoan.paidInterest = 0;
        newLoan.actualDate = '';

        const startD = renewStartDate;
        const dd = String(startD.getDate()).padStart(2, '0');
        const mm = String(startD.getMonth() + 1).padStart(2, '0');
        const yyyy = startD.getFullYear();
        newLoan.borrowDate = `${dd}/${mm}/${yyyy}`;

        const newDueDateObj = new Date(startD.getTime() + ((targetLoan.daysBorrowed || 7) * 24 * 60 * 60 * 1000));
        const dueDd = String(newDueDateObj.getDate()).padStart(2, '0');
        const dueMm = String(newDueDateObj.getMonth() + 1).padStart(2, '0');
        const dueYyyy = newDueDateObj.getFullYear();
        newLoan.dueDate = `${dueDd}/${dueMm}/${dueYyyy}`;

        updatedLoans.push(newLoan);
      }

      updatedLoans[loanIndex] = targetLoan;
      applyLoans(updatedLoans);
    }
    const prevLoans = data.loans;

    const renewFromDateStr = action === 'ต่อดอก' ? formatToThaiStr(renewStartDate) : undefined;
    const success = await updateLoanStatus(currentLoan.id, action, formattedActionDate, hasPenalty ? penaltyAmount : 0, renewFromDateStr);

    if (!success) {
      applyLoans(prevLoans); // rollback
      showToast(t('sheetsUpdateFailed', lang), 'error');
      setIsSyncing(false);
    } else {
      setIsSyncing(false);
      setTimeout(() => loadData(true), 1500);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedLoan || !data) return;

    setIsSyncing(true);
    const currentLoan = { ...selectedLoan };

    try {
      const success = await editExistingLoan(currentLoan.id, {
        principal: parseFloat(editLoanForm.principal),
        borrowDate: formatToThaiStr(editLoanForm.borrowDate),
        dueDate: formatToThaiStr(editLoanForm.dueDate),
        daysBorrowed: editLoanForm.daysBorrowed,
        interestRate: editLoanForm.interestRate,
        expectedInterest: editLoanForm.expectedInterest
      });

      if (success) {
        showToast(t('loanUpdated', lang), 'success');
        setIsEditingLoan(false);

        // Optimistic UI update for edits
        const updatedLoans = [...data.loans];
        const loanIndex = updatedLoans.findIndex(l => l.id === currentLoan.id);
        if (loanIndex > -1) {
          updatedLoans[loanIndex] = {
            ...updatedLoans[loanIndex],
            principal: parseFloat(editLoanForm.principal),
            borrowDate: formatToThaiStr(editLoanForm.borrowDate),
            dueDate: formatToThaiStr(editLoanForm.dueDate),
            daysBorrowed: editLoanForm.daysBorrowed,
            interestRate: editLoanForm.interestRate,
            expectedInterest: editLoanForm.expectedInterest,
            totalExpected: parseFloat(editLoanForm.principal) + editLoanForm.expectedInterest
          };
          applyLoans(updatedLoans);
          setSelectedLoan(updatedLoans[loanIndex]);
        }
      } else {
        throw new Error("API failed");
      }
    } catch (err) {
      showToast(t('loanUpdateFailed', lang), 'error');
    } finally {
      setIsSyncing(false);
      setTimeout(() => loadData(true), 2500);
    }
  };

  const handleEnableNotif = async () => {
    const sub = await subscribeToPush();
    if (sub) {
      setIsSubscribed(true);
      setNotifPermission('granted');
      showToast(t('notifSuccess', lang), 'success');
    } else {
      showToast(t('notifFailed', lang), 'error');
    }
  };

  const handleDisableNotif = async () => {
    await unsubscribeFromPush();
    setIsSubscribed(false);
    showToast(t('notifDisabledToast', lang), 'success');
  };

  const handleTestNotif = async (type: 'morning' | 'afternoon' | 'evening') => {
    setIsSendingTestNotif(true);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueTomorrowLoans = data ? data.loans.filter(l => {
      if (l.isPaid || l.isScam || l.isRenewed || l.isWithdrawn) return false;
      const parsed = parseThaiDate(l.dueDate);
      return parsed && parsed.getTime() === tomorrow.getTime();
    }) : [];

    const fmt = (n: number) => '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
    const nameList = (loans: typeof dueTodayLoans, limit = 3) => {
      const shown = loans.slice(0, limit).map(l => `${l.name} ${fmt(l.totalExpected)}`);
      const extra = loans.length - limit;
      return shown.join(', ') + (extra > 0 ? ` +${extra} ราย` : '');
    };

    if (type === 'morning') {
      const total = dueTodayLoans.length + overdueLoans.length;
      if (total === 0) {
        await sendTestNotification('LoanTrack · สรุปยอดวันนี้', 'วันนี้ไม่มียอดที่ต้องติดตาม');
      } else {
        const lines: string[] = [];
        if (dueTodayLoans.length > 0) lines.push(`นัดวันนี้  ${nameList(dueTodayLoans)}  รวม ${fmt(dueTodayLoans.reduce((s, l) => s + l.totalExpected, 0))}`);
        if (overdueLoans.length > 0) {
          const maxDays = Math.max(...overdueLoans.map(l => l.daysLate));
          lines.push(`ค้างชำระ  ${overdueLoans.length} ราย  [+${maxDays} วัน]  รวม ${fmt(overdueLoans.reduce((s, l) => s + l.totalExpected, 0))}`);
        }
        await sendTestNotification('LoanTrack · สรุปยอดวันนี้', lines.join('\n'));
      }
    } else if (type === 'afternoon') {
      if (dueTodayLoans.length === 0) {
        await sendTestNotification('LoanTrack · รายการรอติดตาม', 'ยอดทั้งหมดชำระครบแล้ว');
      } else {
        const total = fmt(dueTodayLoans.reduce((s, l) => s + l.totalExpected, 0));
        await sendTestNotification('LoanTrack · รายการรอติดตาม', `${dueTodayLoans.length} ราย ยังไม่ชำระ  รวม ${total}\n${nameList(dueTodayLoans)}`);
      }
    } else {
      if (dueTomorrowLoans.length === 0) {
        await sendTestNotification('LoanTrack · ครบกำหนดพรุ่งนี้', 'ไม่มีรายการครบกำหนดพรุ่งนี้');
      } else {
        const total = fmt(dueTomorrowLoans.reduce((s, l) => s + l.totalExpected, 0));
        await sendTestNotification('LoanTrack · ครบกำหนดพรุ่งนี้', `${dueTomorrowLoans.length} ราย นัดชำระพรุ่งนี้  รวม ${total}\n${nameList(dueTomorrowLoans)}`);
      }
    }
    setIsSendingTestNotif(false);
  };

  // ── INITIAL LOAD + AUTO-REFRESH ───────────────────────────────
  // โหลดข้อมูลครั้งแรก + ลงทะเบียน Service Worker สำหรับ push notification
  // loadData() (ถูกนิยามในไฟล์นี้ด้านบน) ถูกเรียกซ้ำทุก 2 นาทีด้วย
  useEffect(() => {
    fetchReminderTemplate().then(t => { if (t) setReminderTemplate(t); });
  }, []);

  useEffect(() => {
    fetchCapital()
      .then(cfg => {
        capitalRef.current = cfg.capital;
        setCapitalCfg(cfg);
        return fetchAppData(cfg.capital);
      })
      .then(res => {
        if (res) setData(res);
        else setError(true);
      })
      .catch(err => {
        console.error("fetchAppData error:", err);
        setError(true);
      })
      .finally(() => setLoading(false));

    registerServiceWorker().then(async (reg) => {
      if (!reg) return;
      setNotifPermission(getNotificationPermission());
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, []);

  // Esc ปิดหน้าต่างที่เด้งขึ้นมา (บนสุดก่อน)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editingTemplate) setEditingTemplate(false);
      else if (reminderLoan) setReminderLoan(null);
      else if (showReconcile) setShowReconcile(false);
      else if (showReserveBreakdown) setShowReserveBreakdown(false);
      else if (showProfitModal) setShowProfitModal(false);
      else if (showWeeklySheet) setShowWeeklySheet(false);
      else if (showNotifModal) setShowNotifModal(false);
      else if (showWithdrawModal) setShowWithdrawModal(false);
      else if (showNewLoanModal) setShowNewLoanModal(false);
      else if (showFabMenu) setShowFabMenu(false);
      else if (selectedLoan) setSelectedLoan(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingTemplate, reminderLoan, showReconcile, showReserveBreakdown, showProfitModal, showWeeklySheet, showNotifModal, showWithdrawModal, showNewLoanModal, showFabMenu, selectedLoan]);

  // ── DESIGN TOKENS ─────────────────────────────────────────────
  // สีทั้งหมดของ app อยู่ที่นี่ — เปลี่ยนตรงนี้จุดเดียวเพื่อเปลี่ยน theme
  const D_T = {
    bg: '#f7f1e3', surface: '#ffffff', surface2: '#fbf6ec',
    ink: '#1b1f2a', ink2: '#3a4254', mute: '#7a8298', mute2: '#aab1bd',
    line: '#ece3cf', line2: '#f3eada',
    mint: '#a8d8b9', mintDeep: '#2f7a5a',
    butter: '#fae28d', butterDeep: '#9a7a14',
    blush: '#f6c3b1', blushDeep: '#a04a2c',
    lavender: '#cdc6f0', lavDeep: '#3d3680',
  };

  const dChipMap: Record<string, [string, string]> = {
    mint:   [D_T.mint,   D_T.mintDeep],
    butter: [D_T.butter, D_T.butterDeep],
    blush:  [D_T.blush,  D_T.blushDeep],
    lav:    [D_T.lavender, D_T.lavDeep],
    ghost:  ['rgba(27,31,42,.06)', D_T.ink2],
  };

  const DChip = ({ children, tone = 'mint' }: { children: React.ReactNode; tone?: string }) => {
    const [bg, fg] = dChipMap[tone] ?? dChipMap.ghost;
    return (
      <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color: fg,
                     fontSize: 12, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase',
                     display: 'inline-block', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    );
  };

  const getLoanTone = (l: LoanRecord): string => {
    if (l.isScam) return 'blush';
    if (l.isRenewed) return 'lav';
    if (l.isPaid) return 'mint';
    if (l.isWithdrawn) return 'butter';
    if (l.isOverdue) return 'blush';
    const parsed = parseThaiDate(l.dueDate);
    if (parsed && parsed.getTime() === today.getTime()) return 'butter';
    return 'ghost';
  };

  const getLoanStatusText = (l: LoanRecord): string => {
    if (l.isScam) return lang === 'th' ? 'หนี้เสีย' : 'Bad debt';
    if (l.isRenewed) return lang === 'th' ? 'ต่อสัญญา' : 'Renewed';
    if (l.isPaid) return lang === 'th' ? 'จ่ายแล้ว' : 'Paid';
    if (l.isWithdrawn) return lang === 'th' ? 'เบิก' : 'Payout';
    if (l.isOverdue) return lang === 'th' ? `ช้า ${l.daysLate}วัน` : `${l.daysLate}d late`;
    const parsed = parseThaiDate(l.dueDate);
    if (parsed && parsed.getTime() === today.getTime()) return lang === 'th' ? 'วันนี้' : 'Today';
    return lang === 'th' ? 'ตามแผน' : 'On track';
  };

  const getLoyaltyTier = (renewals: number): { label: string; color: string; bg: string } | null => {
    if (renewals >= 6) return { label: lang === 'th' ? '★ VIP' : '★ VIP', color: D_T.butterDeep, bg: D_T.butter };
    if (renewals >= 3) return { label: lang === 'th' ? '★ ประจำ' : '★ Loyal', color: D_T.mintDeep, bg: D_T.mint };
    if (renewals >= 1) return { label: lang === 'th' ? '★ ปกติ' : '★ Regular', color: D_T.mute, bg: D_T.surface2 };
    return null;
  };

  if (loading) {
    // Skeleton ที่หน้าตาเหมือนหน้าหลักจริง (แทนจุดเด้ง) — ผู้ใช้เห็นโครงก่อนข้อมูลมา
    const bar = (w: number | string, h: number, r = 8, extra: React.CSSProperties = {}) => (
      <div className="lt-sk" style={{ width: w, height: h, borderRadius: r, background: D_T.line, ...extra }} />
    );
    return (
      <div role="status" aria-label={lang === 'th' ? 'กำลังโหลดข้อมูล…' : 'Loading your data…'}
        style={{ minHeight: '100vh', background: D_T.bg, padding: '12px 16px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {bar(32, 32, 8)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{bar(80, 12, 4)}{bar(48, 16, 4)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>{bar(32, 32, 8)}{bar(32, 32, 8)}</div>
        </div>
        <div style={{ padding: 24, borderRadius: 24, background: D_T.surface, border: `1px solid ${D_T.line}`, marginBottom: 12 }}>
          {bar(96, 12, 4, { marginBottom: 12 })}
          {bar(200, 40, 8, { marginBottom: 12 })}
          {bar(120, 12, 4, { marginBottom: 24 })}
          {bar('100%', 120, 12, { marginBottom: 16 })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{bar('100%', 64, 12)}{bar('100%', 64, 12)}</div>
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16,
                                background: D_T.surface, border: `1px solid ${D_T.line}`, marginBottom: 8 }}>
            {bar(40, 40, 12)}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>{bar('60%', 12, 4)}{bar('40%', 12, 4)}</div>
            {bar(64, 16, 4)}
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: D_T.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: 24, fontFamily: '"Manrope", "IBM Plex Sans Thai", system-ui, sans-serif' }}>
        <div style={{ background: D_T.surface, padding: 32, borderRadius: 16, border: `1px solid ${D_T.line}`,
                      textAlign: 'center', maxWidth: 360, width: '100%' }}>
          <div style={{ fontSize: 30, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: D_T.ink, marginBottom: 8 }}>ไม่สามารถเชื่อมต่อได้</div>
          <div style={{ fontSize: 12, color: D_T.mute, marginBottom: 24 }}>Failed to sync. Check your connection.</div>
          <button onClick={() => window.location.reload()}
            style={{ width: '100%', padding: '12px 0', background: D_T.ink, color: D_T.bg,
                     border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const nplRatio = ((s.scamPrincipal / Math.max(1, s.totalBorrowed)) * 100);

  const DAreaChart = ({ sparkData, w = 680, h = 150, showYAxis = false }: {
    sparkData: { date: string; value: number }[];
    w?: number; h?: number; showYAxis?: boolean;
  }) => {
    if (sparkData.length < 2) return <div style={{ height: h }} />;
    const yPad = showYAxis ? 56 : 0;
    const chartW = w - yPad;
    const vals = sparkData.map(d => d.value);
    const max = Math.max(...vals, 1);
    const stepX = chartW / Math.max(sparkData.length - 1, 1);
    const toY = (v: number) => h - (v / max) * (h - 28) - 14;
    const pts = vals.map((v, i) => [yPad + i * stepX, toY(v)] as [number, number]);
    const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const fillPath = path + ` L ${yPad + chartW},${h} L ${yPad},${h} Z`;
    const yTicks = [0, 0.25, 0.5, 0.75, 1];
    return (
      <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="d-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={D_T.mintDeep} stopOpacity="0.35" />
            <stop offset="100%" stopColor={D_T.mintDeep} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map(p => {
          const y = toY(p * max);
          return (
            <g key={p}>
              <line x1={yPad} y1={y} x2={yPad + chartW} y2={y} stroke={D_T.line} strokeDasharray="2 5" />
              {showYAxis && p > 0 && (
                <text x={yPad - 6} y={y + 4} textAnchor="end" fontSize="9"
                      fill={D_T.mute2} style={{ fontFamily: mono, fontVariantNumeric: 'tabular-nums' }}>
                  {max >= 10000 ? `${(p * max / 1000).toFixed(0)}k` : (p * max).toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
        <path d={fillPath} fill="url(#d-grad)" />
        <path d={path} fill="none" stroke={D_T.mintDeep} strokeWidth="2" strokeLinejoin="round" />
        {pts.map(([x, y], i) => i === pts.length - 1 && (
          <g key={i}>
            <circle cx={x} cy={y} r="7" fill={D_T.bg} />
            <circle cx={x} cy={y} r="4.5" fill={D_T.mintDeep} />
          </g>
        ))}
      </svg>
    );
  };

  // ── INLINE COMPONENTS ─────────────────────────────────────────
  // Component เล็กๆ ที่ใช้ D_T และ state จาก scope นี้ จึงนิยามไว้ใน App
  const font = '"Manrope", "IBM Plex Sans Thai", system-ui, sans-serif';
  const mono = '"Geist Mono", ui-monospace, monospace';

  // กราฟเส้น Portfolio Growth: historical (เส้นทึบ) + forecast (เส้นประ)
  // รองรับ 3 เส้น: portfolio net / gross / interest-only (toggle ได้)
  const PortfolioGrowthChart = ({ compact = false, hideControls = false }: { compact?: boolean; hideControls?: boolean }) => {
    const pts = filteredPortfolioData;
    const YELLOW = '#f5a623', RED = '#e04545';
    const INITIAL = CAPITAL;
    const sfx = compact ? 'c' : 'f';

    const h = compact ? 150 : 210;
    const padL = 6, padR = 4, padT = 10, padB = 22;
    const minPtsWidth = compact ? 24 : 36;
    const W = Math.max(pts.length * minPtsWidth + padL + padR, compact ? 280 : 480);
    const cW = W - padL - padR, cH = h - padT - padB;
    const stepX = cW / Math.max(pts.length - 1, 1);
    const toX = (i: number) => padL + i * stepX;

    const allVals = pts.flatMap(p => [
      p.portfolio, p.portfolioF,
      showPortfolioLine3 ? p.interest : undefined,
      showPortfolioLine3 ? p.interestF : undefined,
      showPortfolioLine2 ? p.gross : undefined,
      showPortfolioLine2 ? p.grossF : undefined,
    ].filter((v): v is number => v !== undefined));
    const minV = allVals.length ? Math.min(...allVals) * 0.98 : 0;
    const maxV = allVals.length ? Math.max(...allVals) * 1.02 : 1;
    const range = maxV - minV || 1;
    const toY = (v: number) => padT + cH - ((v - minV) / range) * cH;

    const makePath = (key: 'portfolio' | 'portfolioF' | 'gross' | 'grossF' | 'interest' | 'interestF') => {
      let d = '';
      pts.forEach((p, i) => {
        const v = (p as any)[key] as number | undefined;
        if (v === undefined) return;
        d += d === '' ? `M${toX(i).toFixed(1)},${toY(v).toFixed(1)}` : ` L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`;
      });
      return d;
    };

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => minV + f * range);
    const thresholdY = Math.min(Math.max(toY(INITIAL), padT), padT + cH);
    const fmtY = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0);

    const handleTap = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as React.TouchEvent).changedTouches[0]?.clientX : (e as React.MouseEvent).clientX;
      if (clientX === undefined) return;
      // getBoundingClientRect already reflects scroll offset, so clientX - rect.left = SVG-space X
      const relX = clientX - rect.left;
      const rawIdx = Math.round((relX - padL) / stepX);
      const idx = Math.max(0, Math.min(pts.length - 1, rawIdx));
      setPortfolioTooltipIdx(prev => {
        const globalIdx = portfolioGrowthData.indexOf(pts[idx]);
        return prev === globalIdx ? null : globalIdx;
      });
    };

    const ttPt = portfolioTooltipIdx !== null ? portfolioGrowthData[portfolioTooltipIdx] : null;
    const ttLocalIdx = ttPt ? pts.indexOf(ttPt) : -1;
    const ttX = ttLocalIdx >= 0 ? toX(ttLocalIdx) : -999;
    const ttVal = ttPt?.portfolio ?? ttPt?.portfolioF;
    const ttY = ttVal !== undefined ? toY(ttVal) : padT;
    const lastHistIdx = pts.reduce((acc, p, i) => p.portfolio !== undefined ? i : acc, -1);

    return (
      <div>
        {/* Controls */}
        {!hideControls && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
            {/* Timeframe */}
            <div style={{ display: 'flex', gap: 2 }}>
              {(['1W', '1M', '3M', '6M', 'all'] as const).map(tf => (
                <button key={tf} onClick={() => { setPortfolioTimeframe(tf); setPortfolioTooltipIdx(null); }}
                  style={{ padding: '4px 8px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: font,
                           fontSize: 12, fontWeight: 700,
                           background: portfolioTimeframe === tf ? D_T.ink : D_T.surface2,
                           color: portfolioTimeframe === tf ? D_T.bg : D_T.mute }}>
                  {tf === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') : tf}
                </button>
              ))}
            </div>
            {/* Line toggles */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setShowPortfolioLine2(v => !v)}
                style={{ padding: '2px 8px', borderRadius: 999, cursor: 'pointer', fontFamily: font,
                         fontSize: 12, fontWeight: 700,
                         background: showPortfolioLine2 ? D_T.butter : D_T.surface2,
                         color: showPortfolioLine2 ? D_T.butterDeep : D_T.mute,
                         border: `1px solid ${showPortfolioLine2 ? D_T.butterDeep : D_T.line}` }}>
                {lang === 'th' ? 'กรอส' : 'Gross'}
              </button>
              <button onClick={() => setShowPortfolioLine3(v => !v)}
                style={{ padding: '2px 8px', borderRadius: 999, cursor: 'pointer', fontFamily: font,
                         fontSize: 12, fontWeight: 700,
                         background: showPortfolioLine3 ? D_T.lavender : D_T.surface2,
                         color: showPortfolioLine3 ? D_T.lavDeep : D_T.mute,
                         border: `1px solid ${showPortfolioLine3 ? D_T.lavDeep : D_T.line}` }}>
                {lang === 'th' ? 'ดอกสะสม' : 'Interest'}
              </button>
            </div>
          </div>
        )}

        {/* Two-column chart layout: scrollable main + fixed Y-axis */}
        <div style={{ display: 'flex', position: 'relative' }}>
        {/* Scrollable chart */}
        <div ref={portfolioChartCallbackRef}
             onScroll={(e) => { portfolioScrollPos.current = e.currentTarget.scrollLeft; }}
             style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', flex: 1, position: 'relative' }}>
          <svg width={W} height={h} style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
               onClick={handleTap} onTouchEnd={handleTap}>
            <defs>
              <linearGradient id="pg-grad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={D_T.mintDeep} stopOpacity="0.16" />
                <stop offset="100%" stopColor={D_T.mintDeep} stopOpacity="0" />
              </linearGradient>
              <clipPath id={`pg-above-${sfx}`}>
                <rect x={0} y={padT} width={W} height={Math.max(0, thresholdY - padT)} />
              </clipPath>
              <clipPath id={`pg-below-${sfx}`}>
                <rect x={0} y={thresholdY} width={W} height={Math.max(0, padT + cH - thresholdY)} />
              </clipPath>
            </defs>

            {/* Y grid lines only (labels are in the fixed column) */}
            {yTicks.map((v, i) => (
              <line key={i} x1={padL} y1={toY(v)} x2={W - padR} y2={toY(v)} stroke={D_T.line} strokeDasharray="2 6" />
            ))}

            {/* X date labels */}
            {pts.map((p, i) => {
              const step = Math.max(1, Math.ceil(pts.length / 7));
              if (i % step !== 0 && i !== pts.length - 1) return null;
              return (
                <text key={i} x={toX(i)} y={h - 4} textAnchor="middle" fontSize={8} fill={p.isForecast ? D_T.mute2 : D_T.mute2}
                      fontFamily={mono} fillOpacity={p.isForecast ? 0.5 : 1}>{p.date}</text>
              );
            })}

            {/* "forecast" region shading */}
            {(() => {
              const firstFcIdx = pts.findIndex(p => p.isForecast && !p.portfolio);
              if (firstFcIdx < 0) return null;
              return <rect x={toX(firstFcIdx)} y={padT} width={W - padR - toX(firstFcIdx)} height={cH}
                           fill={D_T.ink} fillOpacity={0.025} rx={4} />;
            })()}

            {/* Gradient fill under line 1 */}
            {(() => {
              const histPts = pts.filter(p => p.portfolio !== undefined);
              if (histPts.length < 2) return null;
              const firstI = pts.findIndex(p => p.portfolio !== undefined);
              const lastI = lastHistIdx;
              const fillPath = makePath('portfolio') + ` L${toX(lastI).toFixed(1)},${padT + cH} L${toX(firstI).toFixed(1)},${padT + cH} Z`;
              return <path d={fillPath} fill="url(#pg-grad2)" />;
            })()}

            {/* Tooltip crosshair */}
            {ttLocalIdx >= 0 && (
              <line x1={ttX} y1={padT} x2={ttX} y2={padT + cH} stroke={D_T.ink} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} />
            )}

            {/* Line 3: interest only (lavender, hidden by default) */}
            {showPortfolioLine3 && (
              <>
                <path d={makePath('interest')} fill="none" stroke={D_T.lavDeep} strokeWidth={1.5} strokeLinejoin="round" strokeOpacity={0.8} />
                <path d={makePath('interestF')} fill="none" stroke={D_T.lavDeep} strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.3} strokeLinejoin="round" />
              </>
            )}

            {/* Line 2: gross (butter, hidden by default) */}
            {showPortfolioLine2 && (
              <>
                <path d={makePath('gross')} fill="none" stroke={D_T.butterDeep} strokeWidth={1.5} strokeDasharray="6 3" strokeLinejoin="round" strokeOpacity={0.75} />
                <path d={makePath('grossF')} fill="none" stroke={D_T.butterDeep} strokeWidth={1.5} strokeDasharray="6 3" strokeOpacity={0.28} strokeLinejoin="round" />
              </>
            )}

            {/* Line 1: portfolio net — mint above initial capital, red below */}
            <path d={makePath('portfolio')} fill="none" stroke={D_T.mintDeep} strokeWidth={2.5} strokeLinejoin="round" clipPath={`url(#pg-above-${sfx})`} />
            <path d={makePath('portfolio')} fill="none" stroke={RED} strokeWidth={2.5} strokeLinejoin="round" clipPath={`url(#pg-below-${sfx})`} />
            <path d={makePath('portfolioF')} fill="none" stroke={D_T.mintDeep} strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.35} strokeLinejoin="round" />

            {/* Special event dots */}
            {pts.map((p, i) => {
              if (p.portfolio === undefined) return null;
              if (!p.hasW && !p.hasS) return null;
              const cx = toX(i), cy = toY(p.portfolio), r = 5.5;
              if (p.hasW && p.hasS) return (
                <g key={i}>
                  <path d={`M${cx} ${cy - r} A${r} ${r} 0 0 0 ${cx} ${cy + r}Z`} fill={YELLOW} />
                  <path d={`M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r}Z`} fill={RED} />
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke={D_T.surface} strokeWidth={1.5} />
                </g>
              );
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={r} fill={p.hasW ? YELLOW : RED} />
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke={D_T.surface} strokeWidth={1.5} />
                </g>
              );
            })}

            {/* Current value end-dot */}
            {lastHistIdx >= 0 && (() => {
              const p = pts[lastHistIdx];
              const cx = toX(lastHistIdx), cy = toY(p.portfolio!);
              return (
                <g>
                  <circle cx={cx} cy={cy} r={7} fill={D_T.surface} />
                  <circle cx={cx} cy={cy} r={4.5} fill={D_T.mintDeep} />
                </g>
              );
            })()}

            {/* Tooltip dot highlight */}
            {ttLocalIdx >= 0 && ttVal !== undefined && (
              <g>
                <circle cx={ttX} cy={ttY} r={9} fill={D_T.mintDeep} fillOpacity={0.15} />
                <circle cx={ttX} cy={ttY} r={5} fill={D_T.mintDeep} />
              </g>
            )}
          </svg>

          {/* Tooltip card — positioned inside scroll area */}
          {ttPt && ttLocalIdx >= 0 && ttVal !== undefined && (
            <div style={{
              position: 'absolute',
              left: Math.max(4, Math.min(ttX - 70, W - padR - 148)),
              top: Math.max(4, ttY - (ttPt.isForecast ? 80 : ttPt.hasW || ttPt.hasS ? 100 : 68)),
              width: 140, padding: '8px 8px', borderRadius: 8,
              background: D_T.ink, color: D_T.bg, fontSize: 12, fontFamily: font,
              boxShadow: '0 4px 16px rgba(27,31,42,.35)', pointerEvents: 'none', zIndex: 20,
            }}>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
                {ttPt.isForecast ? (lang === 'th' ? '⟳ คาดการณ์' : '⟳ Forecast') : ttPt.date}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, marginBottom: 4 }}>
                {formatCurrency(ttVal)}
              </div>
              {!ttPt.isForecast && (ttPt.earned > 0 || ttPt.scam > 0 || ttPt.withdrawn > 0) && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {ttPt.earned > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ opacity: 0.7 }}>{lang === 'th' ? '+ ดอก/ปรับ' : '+ interest'}</span>
                      <span style={{ color: '#7ef0a8', fontFamily: mono }}>+{formatCurrency(ttPt.earned)}</span>
                    </div>
                  )}
                  {ttPt.hasW && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: YELLOW }}>{lang === 'th' ? `เบิก (${ttPt.wNames.join(',')})` : `W/D (${ttPt.wNames.join(',')})`}</span>
                      <span style={{ color: YELLOW, fontFamily: mono }}>−{formatCurrency(ttPt.withdrawn)}</span>
                    </div>
                  )}
                  {ttPt.hasS && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: RED }}>{lang === 'th' ? `บิด (${ttPt.sNames.join(',')})` : `Default (${ttPt.sNames.join(',')})`}</span>
                      <span style={{ color: RED, fontFamily: mono }}>−{formatCurrency(ttPt.scam)}</span>
                    </div>
                  )}
                </div>
              )}
              {ttPt.isForecast && (ttPt as any).names?.length > 0 && (
                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                  {(ttPt as any).names.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Y-axis column — always visible regardless of scroll */}
        <div style={{ width: 44, flexShrink: 0, background: D_T.surface, position: 'relative', zIndex: 1 }}>
          <svg width={44} height={h} style={{ display: 'block', overflow: 'visible' }}>
            {yTicks.map((v, i) => (
              <text key={i} x={4} y={toY(v) + 3.5} textAnchor="start" fontSize={8.5} fill={D_T.mute2}
                    style={{ fontFamily: mono, fontVariantNumeric: 'tabular-nums' }}>{fmtY(v)}</text>
            ))}
          </svg>
        </div>
        </div>{/* end two-column layout */}

        {/* Legend row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {([
            [D_T.mintDeep, lang === 'th' ? 'พอร์ตสุทธิ' : 'Net portfolio', false],
            ...(showPortfolioLine2 ? [[D_T.butterDeep, lang === 'th' ? 'กรอส' : 'Gross', true]] : []),
            ...(showPortfolioLine3 ? [[D_T.lavDeep, lang === 'th' ? 'ดอกสะสม' : 'Cumul. interest', false]] : []),
            [YELLOW, lang === 'th' ? 'เบิก' : 'Withdrawal', false],
            [RED, lang === 'th' ? 'บิด' : 'Default', false],
          ] as [string, string, boolean][]).map(([color, label, dashed]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {dashed
                ? <svg width={16} height={8}><line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth={2} strokeDasharray="4 2" /></svg>
                : <div style={{ width: 14, height: 2.5, background: color, borderRadius: 2 }} />}
              <span style={{ fontSize: 12, color: D_T.mute, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Minimal sparkline for mobile home — 1M, no controls, Y-axis right, no scroll
  const MiniPortfolioChart = () => {
    const cutoff = Date.now() - 30 * 86400000;
    const pts = portfolioGrowthData.filter(p => p.ms >= cutoff || p.isForecast);
    if (pts.length < 2) return <div style={{ height: 72 }} />;

    const h = 72, padL = 4, padR = 36, padT = 6, padB = 16;
    const W = 320;
    const cW = W - padL - padR, cH = h - padT - padB;
    const stepX = cW / Math.max(pts.length - 1, 1);
    const toX = (i: number) => padL + i * stepX;

    const allVals = pts.flatMap(p => [p.portfolio, p.portfolioF].filter((v): v is number => v !== undefined));
    const minV = allVals.length ? Math.min(...allVals) * 0.99 : 0;
    const maxV = allVals.length ? Math.max(...allVals) * 1.01 : 1;
    const range = maxV - minV || 1;
    const toY = (v: number) => padT + cH - ((v - minV) / range) * cH;
    const fmtY = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0);

    const makePath = (key: 'portfolio' | 'portfolioF') => {
      let d = '';
      pts.forEach((p, i) => {
        const v = p[key]; if (v === undefined) return;
        d += d === '' ? `M${toX(i).toFixed(1)},${toY(v).toFixed(1)}` : ` L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`;
      });
      return d;
    };

    const lastHistIdx = pts.reduce((acc, p, i) => p.portfolio !== undefined ? i : acc, -1);
    const firstHistIdx = pts.findIndex(p => p.portfolio !== undefined);

    return (
      <svg width={W} height={h} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="mini-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={D_T.mintDeep} stopOpacity="0.14" />
            <stop offset="100%" stopColor={D_T.mintDeep} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Subtle Y grid lines + right labels (3 ticks) */}
        {[0, 0.5, 1].map((f, i) => {
          const v = minV + f * range, y = toY(v);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={D_T.line} strokeDasharray="2 5" strokeOpacity={0.7} />
              <text x={W - padR + 3} y={y + 3.5} fontSize={7} fill={D_T.mute2}
                    style={{ fontFamily: mono }}>{fmtY(v)}</text>
            </g>
          );
        })}
        {/* X labels: first & last */}
        {firstHistIdx >= 0 && <text x={toX(firstHistIdx)} y={h - 2} fontSize={7} fill={D_T.mute2} style={{ fontFamily: mono }}>{pts[firstHistIdx].date}</text>}
        {lastHistIdx >= 0 && lastHistIdx !== firstHistIdx && (
          <text x={toX(lastHistIdx)} y={h - 2} textAnchor="middle" fontSize={7} fill={D_T.mute2} style={{ fontFamily: mono }}>{pts[lastHistIdx].date}</text>
        )}
        {/* Forecast region */}
        {(() => {
          const fi = pts.findIndex(p => p.isForecast && !p.portfolio);
          if (fi < 0) return null;
          return <rect x={toX(fi)} y={padT} width={W - padR - toX(fi)} height={cH} fill={D_T.ink} fillOpacity={0.025} rx={2} />;
        })()}
        {/* Gradient fill */}
        {lastHistIdx >= 0 && firstHistIdx >= 0 && (() => {
          const fp = makePath('portfolio') + ` L${toX(lastHistIdx).toFixed(1)},${padT + cH} L${toX(firstHistIdx).toFixed(1)},${padT + cH} Z`;
          return <path d={fp} fill="url(#mini-g)" />;
        })()}
        {/* Lines */}
        <path d={makePath('portfolio')} fill="none" stroke={D_T.mintDeep} strokeWidth={2} strokeLinejoin="round" />
        <path d={makePath('portfolioF')} fill="none" stroke={D_T.mintDeep} strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.35} strokeLinejoin="round" />
      </svg>
    );
  };

  const todayLabel = (() => {
    const d = new Date();
    return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const greetSub = (() => {
    if (dueTodayLoans.length === 0) return lang === 'th' ? 'ไม่มีนัดวันนี้' : 'nothing due today';
    return lang === 'th' ? `เก็บหนี้ ${dueTodayLoans.length} รายวันนี้` : `${dueTodayLoans.length} collection${dueTodayLoans.length > 1 ? 's' : ''} today`;
  })();

  // ── RENDER ────────────────────────────────────────────────────
  // Desktop: sidebar ซ้าย (224px) + main area (flex-1)
  //   main area แบ่ง 3 ส่วน: dashboard | loans table | analytics
  // Mobile:  bottom nav bar + content ตาม activeMobileTab
  // Modal stack: ทุก modal render ที่ท้าย return ด้วย position:fixed z-index 70+
  return (
    <div style={{ minHeight: '100vh', background: D_T.bg, color: D_T.ink, fontFamily: font }}>

      {/* ── DESKTOP LAYOUT ─────────────────────────────── */}
      {isDesktop && <div style={{ minHeight: '100vh', display: 'flex' }}>

        {/* Sidebar */}
        <aside style={{ width: 224, minHeight: '100vh', padding: '24px 16px', display: 'flex',
                        flexDirection: 'column', gap: 4, background: D_T.surface2,
                        borderRight: `1px solid ${D_T.line}`, position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: '100vh', overflowY: 'auto' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 16px',
                        borderBottom: `1px solid ${D_T.line}`, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: D_T.ink, color: D_T.butter,
                          display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700 }}>P</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.02em' }}>
                {lang === 'th' ? 'พ็อกเก็ต แบงก์' : 'Pocket Bank'}
              </div>
              <div style={{ fontSize: 12, color: D_T.mute }}>
                {lang === 'th' ? 'โต๊ะปล่อยกู้เล็กๆ' : 'your tiny lending desk'}
              </div>
            </div>
          </div>

          {/* Nav */}
          {([
            [lang === 'th' ? 'ภาพรวม' : 'Overview', 'dashboard', '◉', overdueLoans.length > 0 ? overdueLoans.length : null],
            [lang === 'th' ? 'สินเชื่อ' : 'Loans', 'loans', '◇', tabCounts.all > 0 ? tabCounts.all : null],
            [lang === 'th' ? 'รายงาน' : 'Reports', 'analytics', '◑', null],
          ] as [string, string, string, number | null][]).map(([label, tab, icon, badge]) => (
            <div key={tab}
              {...tap(() => setActiveMobileTab(tab as any))}
              style={{ padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                       background: activeMobileTab === tab ? D_T.surface : 'transparent',
                       color: activeMobileTab === tab ? D_T.ink : D_T.ink2,
                       fontSize: 12, fontWeight: activeMobileTab === tab ? 700 : 500,
                       display: 'flex', alignItems: 'center', gap: 8,
                       boxShadow: activeMobileTab === tab ? '0 1px 0 rgba(27,31,42,.04)' : 'none' }}>
              <span style={{ width: 16, display: 'grid', placeItems: 'center', color: activeMobileTab === tab ? D_T.mintDeep : D_T.mute2 }}>{navIcon(tab, activeMobileTab === tab, 16)}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge !== null && (
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999,
                               background: D_T.bg, color: D_T.mute, fontWeight: 700 }}>{badge}</span>
              )}
            </div>
          ))}

          <div style={{ flex: 1 }} />

          {/* Sync status */}
          <div style={{ padding: 12, borderRadius: 12, background: D_T.surface, border: `1px solid ${D_T.line}`, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99,
                             background: isSyncing ? D_T.butterDeep : D_T.mintDeep, display: 'block' }} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{isSyncing ? (lang === 'th' ? 'กำลังซิงค์…' : 'Syncing…') : (lang === 'th' ? 'ซิงค์แล้ว' : 'Synced')}</span>
            </div>
            <div style={{ fontSize: 12, color: D_T.mute, lineHeight: 1.5 }}>
              {lang === 'th' ? 'ดึงจาก Google Sheets' : 'Pulled from your Sheets ledger.'}
            </div>
          </div>

          {/* Lang + refresh */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={toggleLang} aria-label={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, fontSize: 12, fontWeight: 700,
                       color: D_T.ink2, cursor: 'pointer', fontFamily: font }}>
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <button onClick={() => loadData()} aria-label={lang === 'th' ? 'รีเฟรชข้อมูล' : 'Refresh data'}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, fontSize: 12, fontWeight: 700,
                       color: D_T.ink2, cursor: 'pointer', fontFamily: font }}>
              <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
            </button>
            <button onClick={() => setShowNotifModal(true)} aria-label={lang === 'th' ? 'ตั้งค่าการแจ้งเตือน' : 'Notification settings'}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, fontSize: 14, cursor: 'pointer' }}>
              {isSubscribed ? <Bell size={16} weight="bold" aria-hidden="true" /> : <BellSlash size={16} weight="bold" aria-hidden="true" />}
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Top bar */}
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                           padding: '16px 24px', borderBottom: `1px solid ${D_T.line}`, background: D_T.bg }}>
            <div>
              <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                            textTransform: 'uppercase', marginBottom: 4 }}>{todayLabel}</div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-.02em' }}>
                {lang === 'th' ? 'สวัสดี,' : 'Hey,'}{' '}
                <span style={{ color: D_T.mute }}>{greetSub}</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowWithdrawModal(true)}
                style={{ padding: '8px 16px', borderRadius: 999, background: D_T.surface,
                         color: D_T.ink, border: `1px solid ${D_T.line}`,
                         fontFamily: font, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'th' ? 'ถอนเงิน' : 'Withdraw'}
              </button>
              <button onClick={() => setShowNewLoanModal(true)}
                style={{ padding: '8px 16px', borderRadius: 999, background: D_T.ink,
                         color: D_T.bg, border: 'none',
                         fontFamily: font, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'th' ? '+ ปล่อยกู้' : '+ Lend money'}
              </button>
            </div>
          </header>

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                        borderBottom: `1px solid ${D_T.line}`, background: D_T.surface }}>
            {([
              [lang === 'th' ? 'พอร์ตรวม' : 'Total portfolio', formatCurrency(s.totalLimit), null, null],
              [lang === 'th' ? 'กำไรสุทธิ' : 'Net profit', formatCurrency(s.netProfit), s.netProfit >= 0 ? '↗' : '↘', s.netProfit >= 0],
              [lang === 'th' ? 'หนี้เสีย' : 'NPL ratio', nplRatio.toFixed(1) + '%', null, false],
              [lang === 'th' ? 'เงินในบัญชี' : 'Cash in account', formatCurrency(s.available), null, null],
            ] as [string, string, string | null, boolean | null][]).map(([label, value, arrow, pos], i) => (
              <div key={label}
                title={i === 3 ? (lang === 'th' ? 'คลิกเพื่อเช็คกับบัญชีจริง' : 'Click to match bank balance') : undefined}
                {...tap(i === 1 ? () => setShowProfitModal(true) : i === 3 ? openReconcile : undefined)}
                style={{ padding: '16px 24px', borderRight: `1px solid ${D_T.line}`,
                         display: 'flex', flexDirection: 'column', gap: 8,
                         cursor: i === 1 || i === 3 ? 'pointer' : 'default' }}>
                <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: D_T.ink,
                              letterSpacing: '-.025em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                              fontFamily: mono }}>{value}</div>
                {arrow && (
                  <DChip tone={pos ? 'mint' : 'blush'}>{arrow} {pos ? '+' : ''}{s.profitPct.toFixed(1)}%</DChip>
                )}
              </div>
            ))}
          </div>

          {/* Body: main + right rail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>

            {/* Left: content area — switches by tab */}
            <section style={{ padding: '24px 24px', overflowY: 'auto' }}>

              {activeMobileTab === 'analytics' ? (
                /* ── ANALYTICS TAB ── */
                <>
                  {/* Portfolio growth chart */}
                  <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                                borderRadius: 16, padding: '16px 24px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700,
                                  letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                      {lang === 'th' ? 'การเติบโตของพอร์ต' : 'Portfolio Growth'}
                    </div>
                    <PortfolioGrowthChart />
                  </div>

                  {/* Interest received chart */}
                  <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                                borderRadius: 16, padding: '16px 24px 16px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700,
                                      letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          {lang === 'th' ? 'ดอกเบี้ยที่ได้รับ · 30 วันล่าสุด' : 'Interest received · last 30 days'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em',
                                         fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                            {formatCurrency(s.paidInterest)}
                          </span>
                          <DChip tone="mint">↗ {s.profitPct.toFixed(1)}%</DChip>
                        </div>
                      </div>
                      <button onClick={() => setShowExpandedTrend(true)}
                        style={{ padding: '4px 12px', borderRadius: 999, background: D_T.ink, color: D_T.bg,
                                 fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: font }}>
                        {lang === 'th' ? 'ขยาย' : 'Expand'}
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <DAreaChart sparkData={trendData30} w={640} h={160} showYAxis />
                    </div>
                    {trendData30.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4,
                                    fontFamily: mono, fontSize: 12, color: D_T.mute2, paddingLeft: 48 }}>
                        {trendData30.filter((_, i) => i % Math.ceil(trendData30.length / 6) === 0).map(m => (
                          <span key={m.date}>{m.date}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Portfolio Health Score */}
                  {(() => {
                    const deployed = s.totalLimit > 0 ? (s.unpaidPrincipal / s.totalLimit) * 100 : 0;
                    const activeLoans = data?.loans.filter(l => !l.isPaid && !l.isScam && !l.isWithdrawn && !l.isRenewed) ?? [];
                    const avgDays = activeLoans.length > 0 ? activeLoans.reduce((sum, l) => sum + l.daysBorrowed, 0) / activeLoans.length : 0;
                    const metrics = [
                      { label: 'Deployed Ratio', value: deployed.toFixed(1) + '%', pct: Math.min(100, deployed), good: deployed >= 80, ok: deployed >= 60, hint: lang === 'th' ? (deployed >= 80 ? 'เงินทำงานดี' : deployed >= 60 ? 'ยังพอได้' : 'เงินนอนมากเกิน') : (deployed >= 80 ? 'Money working' : deployed >= 60 ? 'Acceptable' : 'Too much idle') },
                      { label: 'NPL Ratio', value: nplRatio.toFixed(1) + '%', pct: Math.min(100, nplRatio * 5), good: nplRatio < 5, ok: nplRatio < 10, hint: lang === 'th' ? (nplRatio < 5 ? 'ความเสี่ยงต่ำ' : nplRatio < 10 ? 'ระวังไว้' : 'เสี่ยงสูง') : (nplRatio < 5 ? 'Low risk' : nplRatio < 10 ? 'Watch out' : 'High risk') },
                      { label: lang === 'th' ? 'Avg. ระยะกู้' : 'Avg. Loan Days', value: avgDays > 0 ? avgDays.toFixed(1) + (lang === 'th' ? ' วัน' : 'd') : '—', pct: Math.min(100, (avgDays / 14) * 100), good: avgDays <= 7 && avgDays > 0, ok: avgDays <= 14, hint: lang === 'th' ? (avgDays <= 7 ? 'หมุนเร็ว' : avgDays <= 14 ? 'ปานกลาง' : 'วงจรยาว') : (avgDays <= 7 ? 'Fast cycle' : avgDays <= 14 ? 'Medium' : 'Long cycle') },
                    ];
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
                        {metrics.map(m => (
                          <div key={m.label} style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 16, padding: '16px 16px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: D_T.mute, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>{m.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: mono, color: m.good ? D_T.mintDeep : m.ok ? D_T.butterDeep : D_T.blushDeep, marginBottom: 4 }}>{m.value}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: m.good ? D_T.mintDeep : m.ok ? D_T.butterDeep : D_T.blushDeep, marginBottom: 8 }}>{m.hint}</div>
                            <div style={{ height: 5, borderRadius: 99, background: D_T.line2 }}>
                              <div style={{ height: '100%', width: m.pct + '%', borderRadius: 99, transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)', background: m.good ? D_T.mintDeep : m.ok ? D_T.butterDeep : D_T.blushDeep }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* เบิกได้จริง — desktop analytics */}
                  {reserveData.totalLocked > 0 && (
                    <div {...tap(() => setShowReserveBreakdown(true))}
                      style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                               borderRadius: 16, padding: '16px 24px', marginBottom: 16, cursor: 'pointer',
                               display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                                      color: D_T.mute, marginBottom: 4 }}>
                          {lang === 'th' ? 'เบิกได้จริง' : 'Safe to withdraw'}
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: mono, lineHeight: 1, letterSpacing: '-.025em' }}>
                          {formatCurrency(reserveData.safeWithdrawable)}
                        </div>
                        <div style={{ fontSize: 12, color: D_T.mute, marginTop: 4 }}>
                          {lang === 'th' ? `ล็อกดอกสำรองไว้ ${formatCurrency(reserveData.totalLocked)}` : `Reserve locked ${formatCurrency(reserveData.totalLocked)}`}
                        </div>
                      </div>
                      <CaretRight size={20} style={{ opacity: .4 }} aria-hidden="true" />
                    </div>
                  )}

                  {/* Monthly summary with breakdown */}
                  {monthlySummary.length > 0 && (
                    <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                                  borderRadius: 16, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${D_T.line}`,
                                    fontSize: 12, fontWeight: 700, color: D_T.mute,
                                    letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {lang === 'th' ? 'สรุปรายเดือน' : 'Monthly Summary'}
                      </div>
                      {monthlySummary.map(m => {
                        const d = new Date(m.year, m.month, 1);
                        const label = d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' });
                        const net = m.interest - m.scam - m.withdrawn;
                        return (
                          <div key={m.key} style={{ padding: '12px 24px', borderBottom: `1px solid ${D_T.line2}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: D_T.ink }}>{label}</div>
                                <div style={{ fontSize: 12, color: D_T.mute, marginTop: 2 }}>
                                  {m.count} {lang === 'th' ? 'รายการ' : 'records'}
                                </div>
                              </div>
                              <DChip tone={net >= 0 ? 'mint' : 'blush'}>
                                {net >= 0 ? '+' : ''}{formatCurrency(net)} net
                              </DChip>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                              {([
                                [lang === 'th' ? 'รายได้ดอก' : 'Income', m.interest, D_T.mintDeep, D_T.mint],
                                [lang === 'th' ? 'หนี้บิด' : 'Defaults', m.scam, D_T.blushDeep, D_T.blush],
                                [lang === 'th' ? 'เบิก' : 'Withdrawn', m.withdrawn, D_T.butterDeep, D_T.butter],
                                [lang === 'th' ? 'สุทธิ' : 'Total net', net, net >= 0 ? D_T.mintDeep : D_T.blushDeep, net >= 0 ? D_T.mint : D_T.blush],
                              ] as [string, number, string, string][]).map(([lbl, val, fg, bg]) => (
                                <div key={lbl} style={{ padding: '8px 8px', borderRadius: 8, background: bg + '40' }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: fg, letterSpacing: '.04em',
                                                textTransform: 'uppercase', marginBottom: 4 }}>{lbl}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: fg,
                                                fontFamily: mono, fontVariantNumeric: 'tabular-nums' }}>
                                    {formatCurrency(val)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* ── OVERVIEW / LOANS TAB ── */
                <>
                  {/* Portfolio growth chart — overview tab only */}
                  {activeMobileTab !== 'loans' && (
                    <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                                  borderRadius: 16, padding: '16px 24px 16px', marginBottom: 24 }}>
                      <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700,
                                    letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                        {lang === 'th' ? 'การเติบโตของพอร์ต' : 'Portfolio Growth'}
                      </div>
                      <PortfolioGrowthChart />
                    </div>
                  )}

                  {/* Table card */}
                  <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 16, padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {([
                          ['all', lang === 'th' ? 'ทั้งหมด' : 'All', tabCounts.all],
                          ['renewals', lang === 'th' ? 'ต่อสัญญา' : 'Renewed', tabCounts.renewals],
                          ['paid', lang === 'th' ? 'จ่ายแล้ว' : 'Paid', tabCounts.paid],
                          ['defaulted', lang === 'th' ? 'หนี้เสีย' : 'Defaulted', tabCounts.defaulted],
                          ['withdrawn', lang === 'th' ? 'เบิก' : 'Withdrawn', tabCounts.withdrawn],
                        ] as [string, string, number][]).map(([tab, label, count]) => (
                          <span key={tab} {...tap(() => { setActiveTab(tab as any); setSearchQuery(''); })}
                            style={{ padding: '4px 12px', borderRadius: 999, cursor: 'pointer',
                                     background: activeTab === tab ? D_T.ink : D_T.surface2,
                                     color: activeTab === tab ? D_T.bg : D_T.ink2,
                                     fontSize: 12, fontWeight: 700,
                                     display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {label}
                            {count > 0 && <span style={{ fontSize: 12, opacity: 0.7 }}>{count}</span>}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                          placeholder={lang === 'th' ? 'ค้นหา…' : 'Search…'}
                          style={{ padding: '4px 12px', borderRadius: 999, border: `1px solid ${D_T.line}`,
                                   background: D_T.surface2, fontSize: 14, color: D_T.ink,
                                   outline: 'none', fontFamily: font, width: 140 }} />
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                          style={{ padding: '4px 8px', borderRadius: 999, border: `1px solid ${D_T.line}`,
                                   background: D_T.surface2, fontSize: 14, color: D_T.ink2,
                                   outline: 'none', fontFamily: font, cursor: 'pointer' }}>
                          <option value="default">{lang === 'th' ? 'ล่าสุด' : 'Latest'}</option>
                          <option value="amount-desc">{lang === 'th' ? 'มากสุด' : 'Highest'}</option>
                          <option value="amount-asc">{lang === 'th' ? 'น้อยสุด' : 'Lowest'}</option>
                          <option value="overdue">{lang === 'th' ? 'ค้างนาน' : 'Most Overdue'}</option>
                          <option value="name">A-Z</option>
                        </select>
                      </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${D_T.line}` }}>
                          {([
                            ['ID', 'left'], [lang === 'th' ? 'ผู้กู้' : 'Borrower', 'left'],
                            [lang === 'th' ? 'เงินต้น' : 'Principal', 'right'],
                            [lang === 'th' ? 'ดอกเบี้ย' : 'Interest', 'right'],
                            [lang === 'th' ? 'อัตรา' : 'Rate', 'right'],
                            [lang === 'th' ? 'กำหนด' : 'Due', 'right'],
                            [lang === 'th' ? 'สถานะ' : 'Status', 'right'],
                          ] as [string, string][]).map(([h, align]) => (
                            <th key={h} style={{ padding: '8px 8px', textAlign: align as any,
                                                 fontSize: 12, color: D_T.mute2, fontWeight: 700,
                                                 letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody ref={tableRef}>
                        {filteredLoans.map(l => (
                          <tr key={l.id} {...tap(() => setSelectedLoan(l))}
                            style={{ borderBottom: `1px solid ${D_T.line2}`, cursor: 'pointer',
                                     background: selectedLoan?.id === l.id ? D_T.surface2 : 'transparent',
                                     transition: 'background 300ms cubic-bezier(0.22,1,0.36,1)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = D_T.surface2)}
                            onMouseLeave={e => (e.currentTarget.style.background = selectedLoan?.id === l.id ? D_T.surface2 : 'transparent')}>
                            <td style={{ padding: '12px 8px', fontFamily: mono, fontSize: 12, color: D_T.mute2 }}>{l.id}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: D_T.surface2,
                                              border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                                              fontSize: 12, color: D_T.ink, fontWeight: 700, flexShrink: 0 }}>
                                  {l.name.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: 12, color: D_T.ink, fontWeight: 600 }}>{l.name}</span>
                                {l.isOverdue && <DChip tone="blush">{l.daysLate}d</DChip>}
                              </div>
                            </td>
                            <td style={{ padding: '12px 8px', fontFamily: mono, fontSize: 12, color: D_T.ink,
                                         textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                              {formatCurrency(l.principal)}
                            </td>
                            <td style={{ padding: '12px 8px', fontFamily: mono, fontSize: 12,
                                         color: D_T.mintDeep, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              +{formatCurrency(l.expectedInterest)}
                            </td>
                            <td style={{ padding: '12px 8px', fontFamily: mono, fontSize: 12, color: D_T.ink2, textAlign: 'right' }}>
                              {l.interestRate}%
                            </td>
                            <td style={{ padding: '12px 8px', fontSize: 12, color: l.isOverdue ? D_T.blushDeep : D_T.ink2, textAlign: 'right' }}>
                              {l.dueDate}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <DChip tone={getLoanTone(l)}>{getLoanStatusText(l)}</DChip>
                            </td>
                          </tr>
                        ))}
                        {filteredLoans.length === 0 && (
                          <tr><td colSpan={7} style={{ padding: '48px 0', textAlign: 'center', color: D_T.mute, fontSize: 12 }}>
                            {lang === 'th' ? 'ไม่พบรายการ' : 'No results found'}
                            {searchQuery && <span> "{searchQuery}"</span>}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* Right rail */}
            <aside style={{ borderLeft: `1px solid ${D_T.line}`, padding: '24px 24px',
                            background: D_T.bg, display: 'flex', flexDirection: 'column', gap: 16,
                            overflowY: 'auto' }}>

              {/* Today's collections */}
              <div>
                <div style={{ fontSize: 12, color: D_T.butterDeep, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {lang === 'th' ? 'วันนี้' : 'Today'} · {dueTodayLoans.length}
                </div>
                {dueTodayLoans.length === 0 ? (
                  <div style={{ padding: 16, borderRadius: 12, background: D_T.surface2,
                                border: `1px solid ${D_T.line}`, fontSize: 12, color: D_T.mute,
                                textAlign: 'center' }}>
                    {lang === 'th' ? 'ไม่มีนัดวันนี้ 🎉' : 'Nothing due today 🎉'}
                  </div>
                ) : (
                  <div ref={dueListRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dueTodayLoans.map(l => (
                      <div key={l.id} style={{ padding: 16, borderRadius: 16, background: D_T.butter,
                                              boxShadow: '0 1px 0 rgba(27,31,42,.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</span>
                          <DChip tone="ghost">{l.id}</DChip>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.025em',
                                      fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                          {formatCurrency(l.totalExpected)}
                        </div>
                        <div style={{ fontSize: 12, color: D_T.ink2, marginTop: 2 }}>
                          {formatCurrency(l.principal)} + {formatCurrency(l.expectedInterest)} {lang === 'th' ? 'ดอก' : 'interest'}
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                          <button onClick={() => setSelectedLoan(l)}
                            style={{ flex: 1, padding: '8px 0', background: D_T.ink, color: D_T.bg,
                                     border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 700,
                                     cursor: 'pointer', fontFamily: font }}>
                            {lang === 'th' ? 'รับเงินแล้ว' : 'Got paid'}
                          </button>
                          <button onClick={() => setReminderLoan(l)}
                            style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,.6)',
                                     color: D_T.ink, border: 'none', borderRadius: 999,
                                     fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                            {lang === 'th' ? 'ทวง' : 'Remind'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Overdue */}
              {overdueLoans.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: D_T.blushDeep, fontWeight: 700,
                                   letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'ค้างชำระ' : 'Overdue'} · {overdueLoans.length}
                    </span>
                    <span style={{ fontSize: 12, color: D_T.blushDeep, fontWeight: 700, fontFamily: mono }}>
                      −{formatCurrency(overdueLoans.reduce((a, l) => a + l.totalExpected, 0))}
                    </span>
                  </div>
                  <div ref={overdueListRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {overdueLoans.map(l => (
                      <div key={l.id} {...tap(() => setSelectedLoan(l))}
                        style={{ padding: 12, borderRadius: 12, background: D_T.blush, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</span>
                          <span style={{ fontSize: 12, color: D_T.blushDeep, fontWeight: 700 }}>
                            {lang === 'th' ? `ช้า ${l.daysLate} วัน` : `${l.daysLate}d late`}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: D_T.ink2 }}>
                          {formatCurrency(l.principal)} + {formatCurrency(l.expectedInterest)} · {l.dueDate}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allocation — where is my money */}
              {(() => {
                const segs = [
                  { label: lang === 'th' ? 'กำลังทำงาน' : 'Working', value: s.unpaidPrincipal, color: D_T.mintDeep },
                  { label: lang === 'th' ? 'พร้อมปล่อย' : 'Ready', value: s.available, color: D_T.butterDeep },
                  { label: lang === 'th' ? 'หนี้เสีย' : 'Bad debt', value: s.scamPrincipal, color: D_T.blushDeep },
                  { label: lang === 'th' ? 'เบิก' : 'Withdrawn', value: s.withdrawn, color: D_T.mute2 },
                ].filter(sg => sg.value > 0);
                const total = Math.max(segs.reduce((a, sg) => a + sg.value, 0), 1);
                return (
                  <div>
                    <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                      {lang === 'th' ? 'เงินอยู่ที่ไหน' : 'Where is my money'}
                    </div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', gap: 2, marginBottom: 12 }}>
                      {segs.map(sg => (
                        <div key={sg.label} style={{ flex: sg.value / total, background: sg.color, minWidth: 4 }} />
                      ))}
                    </div>
                    {segs.map(sg => (
                      <div key={sg.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 9, height: 9, borderRadius: 2, background: sg.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: D_T.ink2 }}>{sg.label}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: mono, color: D_T.ink }}>{formatCurrency(sg.value)}</span>
                          <span style={{ fontSize: 12, color: D_T.mute, marginLeft: 4 }}>{((sg.value / total) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div style={{ marginTop: 'auto', fontSize: 12, color: D_T.mute2, fontStyle: 'italic', lineHeight: 1.5 }}>
                {lang === 'th' ? '"การปล่อยกู้คือความอดทนที่มีตัวเลขกำกับ"' : '"Lending is patience with a number on it."'}
              </div>
            </aside>
          </div>
        </div>
      </div>}

      {/* ── MOBILE LAYOUT ──────────────────────────────── */}
      {!isDesktop && <div
        style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: 80 }}
      >

        {/* Mobile header */}
        <div style={{ padding: '8px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: D_T.bg, borderBottom: `1px solid ${D_T.line}`, position: 'sticky', top: 0, zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: D_T.ink, color: D_T.butter,
                          display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>P</div>
            <div>
              <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Pocket Bank
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.02em' }}>
                {lang === 'th' ? 'สวัสดี' : 'Hey'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={toggleLang} aria-label={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
              style={{ width: 32, height: 32, borderRadius: 8, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, fontSize: 12, fontWeight: 700,
                       color: D_T.ink2, cursor: 'pointer', fontFamily: font }}>
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <button onClick={() => loadData(false)} disabled={isSyncing} aria-label={lang === 'th' ? 'รีเฟรชข้อมูล' : 'Refresh data'}
              style={{ width: 32, height: 32, borderRadius: 8, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                       fontSize: 14, cursor: isSyncing ? 'default' : 'pointer', opacity: isSyncing ? 0.5 : 1 }}>
              <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', animation: isSyncing ? 'ptr-spin .7s linear infinite' : 'none' }}><ArrowClockwise size={16} weight="bold" /></span>
              <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
            </button>
          </div>
        </div>

        {/* Dashboard tab */}
        {activeMobileTab === 'dashboard' && (
          <div style={{ padding: '8px 16px 0' }}>
            {/* Hero card */}
            <div style={{ padding: 16, borderRadius: 24, background: D_T.surface,
                          border: `1px solid ${D_T.line}`, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 0 }}>
                <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 500 }}>
                  {lang === 'th' ? 'เงินในบัญชี' : 'Cash in account'}
                </div>
                {(() => {
                  const w = weeklySummary.find(x => x.isCurrentWeek);
                  const fi = (v: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(v));
                  return (
                    <button onClick={() => setShowWeeklySheet(true)} style={{
                      background: D_T.mint + '60', border: 'none', borderRadius: 8,
                      padding: '4px 8px', cursor: 'pointer', textAlign: 'right', lineHeight: 1.2 }}>
                      <div style={{ fontSize: 12, color: D_T.mintDeep, fontWeight: 700, letterSpacing: '.04em', marginBottom: 2 }}>
                        {lang === 'th' ? 'สัปดาห์นี้' : 'This week'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: D_T.mintDeep, fontFamily: mono }}>
                        +฿{fi(w?.interest ?? 0)}
                      </div>
                    </button>
                  );
                })()}
              </div>
              <button onClick={openReconcile} className="lt-btn"
                aria-label={lang === 'th' ? 'เช็คกับบัญชีจริง' : 'Match bank balance'}
                style={{ display: 'block', background: 'none', border: 'none', padding: 0, margin: 0,
                         textAlign: 'left', cursor: 'pointer', color: D_T.ink }}>
                <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-.025em', marginTop: 4,
                              lineHeight: '40px', fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                  {formatCurrency(s.available)}
                </div>
                <div style={{ fontSize: 12, color: D_T.mintDeep, fontWeight: 600, marginTop: 4 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {lang === 'th' ? 'เช็คกับบัญชีจริง' : 'Match bank balance'}<CaretRight size={12} weight="bold" aria-hidden="true" />
                  </span>
                </div>
              </button>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <DChip tone={s.netProfit >= 0 ? 'mint' : 'blush'}>
                  {s.netProfit >= 0 ? '↗' : '↘'} {formatCurrency(Math.abs(s.netProfit))}
                </DChip>
                <span style={{ fontSize: 12, color: D_T.mute }}>{s.profitPct.toFixed(1)}% lifetime</span>
              </div>
              <div style={{ marginTop: 12, marginLeft: -4, marginRight: -4, overflowX: 'hidden' }}>
                <MiniPortfolioChart />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <div style={{ padding: 12, borderRadius: 12, background: D_T.surface2 }}>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 500 }}>
                    {lang === 'th' ? 'พอร์ตรวม' : 'Portfolio'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2,
                                fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                    {formatCurrency(s.totalLimit)}
                  </div>
                  <div style={{ fontSize: 12, color: D_T.mute }}>
                    {lang === 'th' ? `ปล่อยอยู่ ${formatCurrency(s.unpaidPrincipal)}` : `Lent out ${formatCurrency(s.unpaidPrincipal)}`}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 12, background: D_T.surface2 }}>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    NPL
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: D_T.blushDeep,
                                fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                    {nplRatio.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Collect today */}
            {dueTodayLoans.length > 0 && (
              <div style={{ padding: 16, borderRadius: 16, background: D_T.butter, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: D_T.butterDeep, fontWeight: 700,
                                  letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'เก็บวันนี้' : 'Collect today'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.025em', marginTop: 2,
                                  fontFamily: mono }}>
                      {formatCurrency(dueTodayLoans.reduce((a, l) => a + l.totalExpected, 0))}
                    </div>
                  </div>
                  <DChip tone="ghost">{dueTodayLoans.length} {lang === 'th' ? 'ราย' : 'due'}</DChip>
                </div>
                {dueTodayLoans.map(l => (
                  <div key={l.id} {...tap(() => setSelectedLoan(l))}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8,
                             background: 'rgba(255,255,255,.6)', borderRadius: 12, marginTop: 8, cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: D_T.ink,
                                  color: D_T.butter, display: 'grid', placeItems: 'center',
                                  fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {l.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: D_T.ink2 }}>
                        {formatCurrency(l.principal)} + {formatCurrency(l.expectedInterest)} · {l.id}
                      </div>
                    </div>
<button onClick={e => { e.stopPropagation(); setReminderLoan(l); }}
                      aria-label={lang === 'th' ? `ทวง ${l.name}` : `Remind ${l.name}`}
                      style={{ padding: '8px 12px', borderRadius: 999, background: D_T.surface,
                               color: D_T.ink, border: 'none', fontSize: 12, fontWeight: 700,
                               fontFamily: font, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ChatCircleText size={14} weight="bold" aria-hidden="true" />
                      {lang === 'th' ? 'ทวง' : 'Remind'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setSelectedLoan(l); }}
                      style={{ padding: '8px 12px', borderRadius: 999, background: D_T.ink,
                               color: D_T.bg, border: 'none', fontSize: 12, fontWeight: 700,
                               fontFamily: font, cursor: 'pointer' }}>
                      {lang === 'th' ? 'รับแล้ว' : 'Paid'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Overdue */}
            {overdueLoans.length > 0 && (
              <div style={{ padding: 16, borderRadius: 16, background: D_T.blush + '60',
                            border: `1px solid ${D_T.blush}`, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: D_T.blushDeep, fontWeight: 700,
                                  letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'เกินกำหนด' : 'Overdue'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.025em', marginTop: 2,
                                  fontFamily: mono, color: D_T.blushDeep }}>
                      {formatCurrency(overdueLoans.reduce((a, l) => a + l.totalExpected, 0))}
                    </div>
                  </div>
                  <DChip tone="blush">{overdueLoans.length} {lang === 'th' ? 'ราย' : 'overdue'}</DChip>
                </div>
                <div ref={overdueListRef} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {overdueLoans.slice(0, 3).map(l => (
                    <div key={l.id} {...tap(() => setSelectedLoan(l))}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px',
                               background: 'rgba(255,255,255,.55)', borderRadius: 12, cursor: 'pointer' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: D_T.blushDeep,
                                    color: '#fff', display: 'grid', placeItems: 'center',
                                    fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {l.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: D_T.ink }}>{l.name}</div>
                        <div style={{ fontSize: 12, color: D_T.blushDeep, fontWeight: 600 }}>
                          {l.daysLate} {lang === 'th' ? 'วัน' : 'd'} · {formatCurrency(l.totalExpected)}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setReminderLoan(l); }}
                      aria-label={lang === 'th' ? `ทวง ${l.name}` : `Remind ${l.name}`}
                      style={{ padding: '8px 12px', borderRadius: 999, background: D_T.blushDeep,
                               color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
                               fontFamily: font, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ChatCircleText size={14} weight="bold" aria-hidden="true" />
                      {lang === 'th' ? 'ทวง' : 'Remind'}
                    </button>
                    </div>
                  ))}
                  {overdueLoans.length > 3 && (
                    <div style={{ textAlign: 'center', fontSize: 12, color: D_T.blushDeep, fontWeight: 700, paddingTop: 2 }}>
                      +{overdueLoans.length - 3} {lang === 'th' ? 'รายเพิ่มเติม' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Loans tab */}
        {activeMobileTab === 'loans' && (
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder={lang === 'th' ? 'ค้นหา…' : 'Search…'}
                  style={{ width: '100%', padding: '8px 32px 8px 12px', borderRadius: 12,
                           border: `1px solid ${D_T.line}`, background: D_T.surface, fontSize: 16,
                           color: D_T.ink, outline: 'none', fontFamily: font, boxSizing: 'border-box' }} />
                {searchQuery && (
                  <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                             background: 'none', border: 'none', cursor: 'pointer', color: D_T.mute, fontSize: 14 }}><X size={16} weight="bold" aria-hidden="true" /></button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }} className="no-scrollbar">
              {(['all', 'renewals', 'paid', 'defaulted', 'withdrawn'] as const).map(tab => (
                <span key={tab} {...tap(() => { setActiveTab(tab); setSearchQuery(''); })}
                  style={{ padding: '4px 12px', borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                           background: activeTab === tab ? D_T.ink : D_T.surface,
                           color: activeTab === tab ? D_T.bg : D_T.ink2,
                           fontSize: 12, fontWeight: 700, border: `1px solid ${D_T.line}`,
                           display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {tab === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') :
                   tab === 'renewals' ? (lang === 'th' ? 'ต่อสัญญา' : 'Renewed') :
                   tab === 'paid' ? (lang === 'th' ? 'จ่ายแล้ว' : 'Paid') :
                   tab === 'defaulted' ? (lang === 'th' ? 'หนี้เสีย' : 'Default') :
                   (lang === 'th' ? 'เบิก' : 'Payout')}
                  {tabCounts[tab] > 0 && <span style={{ fontSize: 12, opacity: .7 }}>{tabCounts[tab]}</span>}
                </span>
              ))}
            </div>
            <div ref={tableRef as any}>
              {filteredLoans.map(l => (
                <div key={l.id} {...tap(() => setSelectedLoan(l))}
                  style={{ background: D_T.surface, borderRadius: 12, padding: '12px 12px', marginBottom: 8,
                           display: 'flex', alignItems: 'center', gap: 12,
                           border: `1px solid ${l.isOverdue ? D_T.blush : D_T.line2}`, cursor: 'pointer' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                                background: getLoanTone(l) === 'blush' ? D_T.blush : getLoanTone(l) === 'mint' ? D_T.mint : D_T.surface2,
                                border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                                fontSize: 12, fontWeight: 700 }}>
                    {l.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</span>
                      <DChip tone={getLoanTone(l)}>{getLoanStatusText(l)}</DChip>
                      {(() => { const stats = borrowerStats.find(b => b.name === l.name); const tier = (!stats?.hasScam) ? getLoyaltyTier(stats?.totalRenewals ?? 0) : null; return tier ? <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 4px', borderRadius: 999, background: tier.bg + '60', color: tier.color }}>{tier.label}</span> : null; })()}
                    </div>
                    <div style={{ fontSize: 12, color: D_T.mute, marginTop: 2 }}>
                      {l.id} · {l.isOverdue ? (lang === 'th' ? `ช้า ${l.daysLate} วัน` : `${l.daysLate}d overdue`) : `${lang === 'th' ? 'กำหนด' : 'due'} ${l.dueDate}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                      {formatCurrency(l.isScam || l.isWithdrawn ? l.principal : l.totalExpected)}
                    </div>
                    <div style={{ fontSize: 12, color: D_T.mute, marginTop: 0 }}>{l.interestRate}%</div>
                  </div>
                </div>
              ))}
              {filteredLoans.length === 0 && (
                <div style={{ padding: '48px 0', textAlign: 'center', color: D_T.mute, fontSize: 12 }}>
                  {lang === 'th' ? 'ไม่พบรายการ' : 'No results found'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics tab */}
        {activeMobileTab === 'analytics' && (
          <div style={{ padding: '12px 16px 0' }}>

            {/* Portfolio growth chart */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                          borderRadius: 16, padding: '12px 16px 12px', marginBottom: 12 }}>
              <PortfolioGrowthChart compact />
            </div>

            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                          borderRadius: 16, padding: '16px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700,
                            letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                {lang === 'th' ? 'ดอกเบี้ยที่ได้รับ · 30 วัน' : 'Interest received · 30 days'}
              </div>
              <div style={{ overflowX: 'hidden' }}>
                <DAreaChart sparkData={trendData30} w={320} h={110} showYAxis />
              </div>
              <button onClick={() => setShowExpandedTrend(true)}
                style={{ marginTop: 8, width: '100%', padding: '8px 0', borderRadius: 999,
                         background: D_T.ink, color: D_T.bg, border: 'none',
                         fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                {lang === 'th' ? 'ดูแบบละเอียด' : 'View full chart'}
              </button>
            </div>

            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {([
                [lang === 'th' ? 'พอร์ตรวม' : 'Portfolio', formatCurrency(s.totalLimit), 'ghost', null],
                [lang === 'th' ? 'กำไรสุทธิ' : 'Net profit', formatCurrency(s.netProfit), s.netProfit >= 0 ? 'mint' : 'blush', () => setShowProfitModal(true)],
                [lang === 'th' ? 'หนี้เสีย' : 'NPL', nplRatio.toFixed(1) + '%', nplRatio > 10 ? 'blush' : 'mint', null],
                [lang === 'th' ? 'เงินในบัญชี' : 'Cash in account', formatCurrency(s.available), 'butter', null],
              ] as [string, string, string, (() => void) | null][]).map(([label, value, tone, onTap]) => (
                <div key={label} {...tap(onTap ?? undefined)}
                  style={{ padding: '12px 16px', borderRadius: 12,
                            background: D_T.surface, border: `1px solid ${D_T.line}`,
                            cursor: onTap ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700,
                                letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '-.02em', fontFamily: mono }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Where is my money */}
            {(() => {
              const segs = [
                { label: lang === 'th' ? 'กำลังทำงาน' : 'Working', value: s.unpaidPrincipal, color: D_T.mintDeep },
                { label: lang === 'th' ? 'พร้อมปล่อย' : 'Ready', value: s.available, color: D_T.butterDeep },
                { label: lang === 'th' ? 'หนี้เสีย' : 'Bad debt', value: s.scamPrincipal, color: D_T.blushDeep },
                { label: lang === 'th' ? 'เบิก' : 'Withdrawn', value: s.withdrawn, color: D_T.mute2 },
              ].filter(sg => sg.value > 0);
              const total = Math.max(segs.reduce((a, sg) => a + sg.value, 0), 1);
              return (
                <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 16, padding: '16px 16px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    {lang === 'th' ? 'เงินอยู่ที่ไหน' : 'Where is my money'}
                  </div>
                  <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', gap: 2, marginBottom: 12 }}>
                    {segs.map(sg => <div key={sg.label} style={{ flex: sg.value / total, background: sg.color, minWidth: 4 }} />)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {segs.map(sg => (
                      <div key={sg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 2, background: sg.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700 }}>{sg.label} {((sg.value / total) * 100).toFixed(0)}%</div>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: mono, color: D_T.ink }}>{formatCurrency(sg.value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Monthly summary — one row per month, no net box */}
            {monthlySummary.length > 0 && (
              <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                            borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line}`,
                              fontSize: 12, fontWeight: 700, color: D_T.mute,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'สรุปรายเดือน' : 'Monthly Summary'}
                </div>
                {monthlySummary.slice(0, 6).map(m => {
                  const d = new Date(m.year, m.month, 1);
                  const label = d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: '2-digit' });
                  const net = m.interest - m.scam - m.withdrawn;
                  return (
                    <div key={m.key} style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line2}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: D_T.ink }}>{label}</span>
                          <span style={{ fontSize: 12, color: D_T.mute, marginLeft: 4 }}>{m.count} {lang === 'th' ? 'ราย' : 'items'}</span>
                        </div>
                        <DChip tone={net >= 0 ? 'mint' : 'blush'}>{net >= 0 ? '+' : ''}{formatCurrency(net)}</DChip>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {m.interest > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: D_T.mintDeep, fontFamily: mono }}>+{formatCurrency(m.interest)}</span>}
                        {m.scam > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: D_T.blushDeep, fontFamily: mono }}>−{formatCurrency(m.scam)}</span>}
                        {m.withdrawn > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: D_T.butterDeep, fontFamily: mono }}>เบิก {formatCurrency(m.withdrawn)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* เบิกได้จริง — mobile analytics */}
            {reserveData.totalLocked > 0 && (
              <div {...tap(() => setShowReserveBreakdown(true))}
                style={{ borderRadius: 16, cursor: 'pointer', marginBottom: 12,
                          background: D_T.surface, border: `1px solid ${D_T.line}`,
                          padding: '16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                                color: D_T.mute, marginBottom: 4 }}>
                    {lang === 'th' ? 'เบิกได้จริง' : 'Safe to withdraw'}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: mono, lineHeight: 1 }}>
                    {formatCurrency(reserveData.safeWithdrawable)}
                  </div>
                  <div style={{ fontSize: 12, color: D_T.mute, marginTop: 4 }}>
                    {lang === 'th' ? `ล็อกดอกสำรอง ${formatCurrency(reserveData.totalLocked)}` : `Reserve locked ${formatCurrency(reserveData.totalLocked)}`}
                  </div>
                </div>
                <CaretRight size={18} style={{ opacity: .5 }} aria-hidden="true" />
              </div>
            )}

          </div>
        )}

        {/* You tab */}
        {activeMobileTab === 'you' && (
          <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Profile card */}
            <div style={{ background: D_T.ink, borderRadius: 16, padding: '16px 16px 16px',
                          display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: D_T.butter,
                            display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 700,
                            color: D_T.ink, flexShrink: 0 }}>P</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: D_T.bg, letterSpacing: '-.01em' }}>
                  {lang === 'th' ? 'พ็อกเก็ต แบงก์' : 'Pocket Bank'}
                </div>
                <div style={{ fontSize: 12, color: D_T.mute2, marginTop: 2 }}>
                  {lang === 'th' ? 'โต๊ะปล่อยกู้ส่วนตัว' : 'Personal lending desk'}
                </div>
              </div>
            </div>

            {/* Capital overview */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '8px 16px', borderBottom: `1px solid ${D_T.line}`,
                            fontSize: 12, fontWeight: 700, color: D_T.mute,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {lang === 'th' ? 'ภาพรวมทุน' : 'Capital Overview'}
              </div>
              {([
                [lang === 'th' ? 'ทุนตั้งต้น' : 'Initial capital', formatCurrency(CAPITAL), D_T.ink, D_T.surface2],
                [lang === 'th' ? 'วงเงินปัจจุบัน' : 'Current limit', formatCurrency(s.totalLimit), D_T.ink, D_T.surface2],
                [lang === 'th' ? 'ออกอยู่' : 'Deployed', formatCurrency(s.totalBorrowed - s.scamPrincipal), D_T.ink2, D_T.surface2],
                [lang === 'th' ? 'เงินในบัญชี' : 'Cash in account', formatCurrency(s.available), D_T.mintDeep, D_T.mint + '25'],
                [lang === 'th' ? 'กำไรสะสม' : 'Profit earned', formatCurrency(s.paidInterest), D_T.mintDeep, D_T.mint + '25'],
                [lang === 'th' ? 'NPL ratio' : 'NPL ratio', nplRatio.toFixed(1) + '%', nplRatio > 10 ? D_T.blushDeep : D_T.mintDeep, nplRatio > 10 ? D_T.blush + '25' : D_T.mint + '25'],
              ] as [string, string, string, string][]).map(([label, value, fg, bg]) => (
                <div key={label} style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line2}`,
                                          background: bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: D_T.ink2, fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: fg,
                                  fontFamily: mono, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                </div>
              ))}
              <button onClick={openReconcile} className="lt-btn"
                style={{ width: '100%', padding: '12px 16px', background: D_T.surface, border: 'none',
                         display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                         cursor: 'pointer', fontFamily: font, color: D_T.ink }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {lang === 'th' ? 'เช็คกับบัญชีจริง' : 'Match bank balance'}
                </span>
                <CaretRight size={16} color={D_T.mute} aria-hidden="true" />
              </button>
              <button onClick={openTemplateEditor} className="lt-btn"
                style={{ width: '100%', padding: '12px 16px', background: D_T.surface, border: 'none',
                         borderTop: `1px solid ${D_T.line2}`,
                         display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                         cursor: 'pointer', fontFamily: font, color: D_T.ink }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {lang === 'th' ? 'ข้อความทวงหนี้' : 'Reminder message'}
                </span>
                <CaretRight size={16} color={D_T.mute} aria-hidden="true" />
              </button>
            </div>

            {/* Settings */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '8px 16px', borderBottom: `1px solid ${D_T.line}`,
                            fontSize: 12, fontWeight: 700, color: D_T.mute,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {lang === 'th' ? 'ตั้งค่า' : 'Settings'}
              </div>

              {/* Language */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line2}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: D_T.ink }}>
                    {lang === 'th' ? 'ภาษา' : 'Language'}
                  </div>
                  <div style={{ fontSize: 12, color: D_T.mute, marginTop: 2 }}>
                    {lang === 'th' ? 'ไทย' : 'English'}
                  </div>
                </div>
                <button onClick={toggleLang}
                  style={{ padding: '4px 12px', borderRadius: 999, border: `1px solid ${D_T.line}`,
                           background: D_T.surface2, fontSize: 12, fontWeight: 700, color: D_T.ink,
                           cursor: 'pointer', fontFamily: font }}>
                  {lang === 'th' ? 'EN' : 'TH'}
                </button>
              </div>

              {/* Notifications */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line2}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: D_T.ink }}>
                      {lang === 'th' ? 'การแจ้งเตือน' : 'Notifications'}
                    </div>
                    <div style={{ fontSize: 12, color: isSubscribed ? D_T.mintDeep : notifPermission === 'denied' ? D_T.blushDeep : D_T.mute, marginTop: 2 }}>
                      {isSubscribed ? (lang === 'th' ? '🔔 เปิดอยู่' : '🔔 On') :
                       notifPermission === 'denied' ? (lang === 'th' ? '🚫 ถูกบล็อก' : '🚫 Blocked') :
                       (lang === 'th' ? '🔕 ปิดอยู่' : '🔕 Off')}
                    </div>
                  </div>
                  {!isSubscribed && notifPermission !== 'denied' && (
                    <button onClick={handleEnableNotif}
                      style={{ padding: '4px 12px', borderRadius: 999, background: D_T.ink,
                               color: D_T.bg, border: 'none', fontSize: 12, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'เปิด' : 'Enable'}
                    </button>
                  )}
                  {isSubscribed && (
                    <button onClick={handleDisableNotif}
                      style={{ padding: '4px 12px', borderRadius: 999, background: D_T.blush,
                               color: D_T.blushDeep, border: 'none', fontSize: 12, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'ปิด' : 'Disable'}
                    </button>
                  )}
                </div>
                {isSubscribed && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    <button onClick={() => handleTestNotif('morning')} disabled={isSendingTestNotif}
                      style={{ padding: '8px 0', borderRadius: 8, background: D_T.lavender,
                               color: D_T.lavDeep, border: 'none', fontSize: 12, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'ทดสอบ เช้า' : 'Test Morning'}
                    </button>
                    <button onClick={() => handleTestNotif('afternoon')} disabled={isSendingTestNotif}
                      style={{ padding: '8px 0', borderRadius: 8, background: D_T.lavender,
                               color: D_T.lavDeep, border: 'none', fontSize: 12, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'ทดสอบ บ่าย' : 'Test Afternoon'}
                    </button>
                    <button onClick={() => handleTestNotif('evening')} disabled={isSendingTestNotif}
                      style={{ padding: '8px 0', borderRadius: 8, background: D_T.lavender,
                               color: D_T.lavDeep, border: 'none', fontSize: 12, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'ทดสอบ เย็น' : 'Test Evening'}
                    </button>
                  </div>
                )}
              </div>

              {/* Dark mode placeholder */}
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: D_T.mute2 }}>
                    {lang === 'th' ? 'โหมดมืด' : 'Dark mode'}
                  </div>
                  <div style={{ fontSize: 12, color: D_T.mute2, marginTop: 2 }}>
                    {lang === 'th' ? 'เร็วๆ นี้' : 'Coming soon'}
                  </div>
                </div>
                <div style={{ width: 36, height: 20, borderRadius: 99, background: D_T.line,
                              display: 'grid', placeItems: 'center' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 99, background: D_T.mute2,
                                marginLeft: -8 }} />
                </div>
              </div>
            </div>

            {/* Data & sync */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 16, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ padding: '8px 16px', borderBottom: `1px solid ${D_T.line}`,
                            fontSize: 12, fontWeight: 700, color: D_T.mute,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {lang === 'th' ? 'ข้อมูล & ซิงค์' : 'Data & Sync'}
              </div>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line2}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: D_T.ink }}>
                    {lang === 'th' ? 'ซิงค์ล่าสุด' : 'Last synced'}
                  </div>
                  <div style={{ fontSize: 12, color: D_T.mute, marginTop: 2 }}>
                    {lastSynced
                      ? lastSynced.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                      : (lang === 'th' ? 'ยังไม่ได้ซิงค์' : 'Not synced yet')}
                  </div>
                </div>
                <button onClick={() => loadData(false)} disabled={isSyncing}
                  style={{ padding: '4px 12px', borderRadius: 999, background: isSyncing ? D_T.surface2 : D_T.ink,
                           color: isSyncing ? D_T.mute : D_T.bg, border: 'none',
                           fontSize: 12, fontWeight: 700, cursor: isSyncing ? 'default' : 'pointer',
                           fontFamily: font, transition: 'opacity 300ms cubic-bezier(0.22,1,0.36,1), transform 300ms cubic-bezier(0.22,1,0.36,1), background 300ms cubic-bezier(0.22,1,0.36,1)' }}>
                  {isSyncing ? (lang === 'th' ? 'กำลังซิงค์…' : 'Syncing…') : (lang === 'th' ? 'รีเฟรช' : 'Refresh')}
                </button>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: D_T.mute2 }}>{lang === 'th' ? 'เวอร์ชัน' : 'Version'}</span>
                <span style={{ fontSize: 12, color: D_T.mute2, fontFamily: mono }}>3.3.2</span>
              </div>
            </div>

          </div>
        )}

        {/* Mobile bottom tab bar */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex',
                      justifyContent: 'space-around', alignItems: 'center',
                      padding: '8px 16px 16px', borderTop: `1px solid ${D_T.line}`,
                      background: D_T.surface, zIndex: 40 }}>
          {([
            ['dashboard', lang === 'th' ? 'หน้าหลัก' : 'Home', '◉'],
            ['loans', lang === 'th' ? 'สินเชื่อ' : 'Loans', '◇'],
            ['fab', '+', '+'],
            ['analytics', lang === 'th' ? 'รายงาน' : 'Reports', '◑'],
            ['you', lang === 'th' ? 'คุณ' : 'You', '○'],
          ] as [string, string, string][]).map(([id, label, icon]) => {
            const isPrimary = id === 'fab';
            const isActive = activeMobileTab === id;
            return (
              <div key={id}
                {...tap(() => {
                  if (id === 'fab') setShowFabMenu(v => !v);
                  else setActiveMobileTab(id as any);
                })}
                aria-label={id === 'fab' ? (lang === 'th' ? 'เมนูเพิ่มรายการ' : 'Add menu') : undefined}
                aria-current={!isPrimary && isActive ? 'page' : undefined}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <div style={{ width: isPrimary ? 44 : 26, height: isPrimary ? 44 : 26,
                               borderRadius: isPrimary ? 14 : 0,
                               background: isPrimary ? D_T.ink : 'transparent',
                               color: isPrimary ? D_T.butter : isActive ? D_T.mintDeep : D_T.mute2,
                               display: 'grid', placeItems: 'center', position: 'relative',
                               fontSize: isPrimary ? 22 : 16, fontWeight: 700 }}>
                  {navIcon(id, isActive, isPrimary ? 22 : 24)}
                  {id === 'loans' && overdueLoans.length > 0 && (
                    <span style={{ position: 'absolute', top: -2, right: -6, width: 14, height: 14,
                                   borderRadius: 99, background: D_T.blushDeep, color: '#fff',
                                   fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                      {overdueLoans.length}
                    </span>
                  )}
                </div>
                {!isPrimary && (
                  <span style={{ fontSize: 12, color: isActive ? D_T.ink : D_T.mute2,
                                 fontWeight: 700, letterSpacing: '.04em' }}>{label}</span>
                )}
              </div>
            );
          })}
        </nav>
      </div>}
      {/* Loan detail drawer / modal */}
      <AnimatePresence>
        {selectedLoan && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
                        alignItems: 'flex-end', justifyContent: 'flex-end',
                        background: 'rgba(27,31,42,.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSelectedLoan(null)}>
            <motion.div
              style={{ width: '100%', maxWidth: 480, height: '94vh', background: D_T.surface,
                       color: D_T.ink, fontFamily: font, overflow: 'hidden',
                       borderLeft: `1px solid ${D_T.line}`, display: 'flex', flexDirection: 'column',
                       boxShadow: '-12px 0 30px -16px rgba(27,31,42,.18)' }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${D_T.line}`,
                            background: D_T.surface2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <DChip tone="ghost">{selectedLoan.id}</DChip>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setIsEditingLoan(!isEditingLoan)} aria-label={lang === 'th' ? 'แก้ไขรายการ' : 'Edit loan'}
                      style={{ width: 30, height: 30, borderRadius: 99, border: `1px solid ${D_T.line}`,
                               background: isEditingLoan ? D_T.lavender : D_T.surface,
                               color: isEditingLoan ? D_T.lavDeep : D_T.ink,
                               fontSize: 12, cursor: 'pointer' }}><PencilSimple size={16} weight="bold" aria-hidden="true" /></button>
                    <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setSelectedLoan(null)}
                      style={{ width: 30, height: 30, borderRadius: 99, border: 'none',
                               background: 'rgba(27,31,42,.06)', fontSize: 14, cursor: 'pointer' }}><X size={16} weight="bold" aria-hidden="true" /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16,
                                background: getLoanTone(selectedLoan) === 'blush' ? D_T.blush :
                                            getLoanTone(selectedLoan) === 'mint' ? D_T.mint :
                                            getLoanTone(selectedLoan) === 'lav' ? D_T.lavender : D_T.butter,
                                color: getLoanTone(selectedLoan) === 'blush' ? D_T.blushDeep :
                                       getLoanTone(selectedLoan) === 'mint' ? D_T.mintDeep :
                                       getLoanTone(selectedLoan) === 'lav' ? D_T.lavDeep : D_T.butterDeep,
                                display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                    {selectedLoan.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>{selectedLoan.name}</div>
                    <div style={{ fontSize: 12, color: D_T.mute, marginTop: 2 }}>
                      {selectedLoan.historicalRenewalCount > 0
                        ? `${lang === 'th' ? 'ต่อสัญญา' : 'Renewed'} ${selectedLoan.historicalRenewalCount} ${lang === 'th' ? 'ครั้ง' : 'time(s)'}`
                        : lang === 'th' ? 'ไม่มีประวัติการต่อสัญญา' : 'No renewals on record'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {isEditingLoan ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'แก้ไขรายการ' : 'Edit loan'}
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        {lang === 'th' ? 'เงินต้น' : 'Principal'}
                      </label>
                      <input type="number" value={editLoanForm.principal}
                        onChange={e => setEditLoanForm({ ...editLoanForm, principal: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${D_T.line}`,
                                 background: D_T.surface2, fontSize: 16, fontWeight: 700, color: D_T.ink,
                                 outline: 'none', fontFamily: mono, boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {[10, 50, 100, 500, 1000].map(amt => (
                          <button key={amt} type="button"
                            onClick={() => setEditLoanForm(f => ({ ...f, principal: String(Math.max(0, parseFloat(f.principal || '0') + amt)) }))}
                            style={{ padding: '4px 8px', borderRadius: 999, background: D_T.surface2,
                                     color: D_T.ink2, fontSize: 12, fontWeight: 700, border: `1px solid ${D_T.line}`, cursor: 'pointer' }}>
                            +{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          {lang === 'th' ? 'ดอกเบี้ย (฿)' : 'Interest (฿)'}
                        </label>
                        <input type="number" value={editLoanForm.expectedInterest}
                          onChange={e => {
                            const amt = Number(e.target.value);
                            const p = parseFloat(editLoanForm.principal) || 1;
                            setEditLoanForm(f => ({ ...f, expectedInterest: amt, interestRate: parseFloat(((amt / p) * 100).toFixed(2)) }));
                          }}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${D_T.line}`,
                                   background: D_T.surface2, fontSize: 16, fontWeight: 700, color: D_T.ink,
                                   outline: 'none', fontFamily: mono, boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                          {[50, 100, 150, 200, 350].map(amt => (
                            <button key={amt} type="button"
                              onClick={() => setEditLoanForm(f => {
                                const newAmt = Math.max(0, f.expectedInterest + amt);
                                const p = parseFloat(f.principal) || 1;
                                return { ...f, expectedInterest: newAmt, interestRate: parseFloat(((newAmt / p) * 100).toFixed(2)) };
                              })}
                              style={{ padding: '4px 8px', borderRadius: 999, background: D_T.surface2,
                                       color: D_T.ink2, fontSize: 12, fontWeight: 700, border: `1px solid ${D_T.line}`, cursor: 'pointer' }}>
                              +{amt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          {lang === 'th' ? 'อัตราดอก (%)' : 'Rate (%)'}
                        </label>
                        <input type="number" value={editLoanForm.interestRate}
                          onChange={e => {
                            const rate = Number(e.target.value);
                            const p = parseFloat(editLoanForm.principal) || 0;
                            setEditLoanForm(f => ({ ...f, interestRate: rate, expectedInterest: parseFloat(((p * rate) / 100).toFixed(2)) }));
                          }}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${D_T.line}`,
                                   background: D_T.surface2, fontSize: 16, fontWeight: 700, color: D_T.ink,
                                   outline: 'none', fontFamily: mono, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          {lang === 'th' ? 'วันที่กู้' : 'Issue date'}
                        </label>
                        <DatePicker selected={editLoanForm.borrowDate}
                          onChange={(date: Date | null) => {
                            if (!date) return;
                            const dDate = new Date(date.getTime() + editLoanForm.daysBorrowed * 86400000);
                            setEditLoanForm(f => ({ ...f, borrowDate: date, dueDate: dDate }));
                          }}
                          dateFormat="dd/MM/yyyy"
                          className="w-full"
                          onFocus={e => e.target.blur()} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          {lang === 'th' ? 'กำหนดชำระ' : 'Due date'}
                        </label>
                        <DatePicker selected={editLoanForm.dueDate}
                          onChange={handleEditDueDateChange}
                          dateFormat="dd/MM/yyyy"
                          className="w-full"
                          onFocus={e => e.target.blur()} />
                      </div>
                    </div>
                    <div style={{ padding: 16, borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12, color: D_T.mute }}>{lang === 'th' ? 'ยอดที่คาดว่าจะรับ' : 'Expected total'}</span>
                        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: mono }}>
                          {formatCurrency(parseFloat(editLoanForm.principal || '0') + editLoanForm.expectedInterest)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Amount */}
                    <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'เขาเป็นหนี้คุณ' : 'They owe you'}
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-.025em', marginTop: 4,
                                  lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                      {formatCurrency(selectedLoan.totalExpected)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <DChip tone={getLoanTone(selectedLoan)}>{getLoanStatusText(selectedLoan)}</DChip>
                      <span style={{ fontSize: 12, color: D_T.mute }}>
                        {lang === 'th' ? 'กำหนด' : 'due'} {selectedLoan.dueDate}
                        {selectedLoan.isOverdue ? ` · ${lang === 'th' ? 'ช้า' : ''} ${selectedLoan.daysLate} ${lang === 'th' ? 'วัน' : 'd late'}` : ''}
                      </span>
                    </div>

                    {/* Breakdown */}
                    <div style={{ marginTop: 24, padding: 16, borderRadius: 16, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                      {[
                        [lang === 'th' ? 'เงินต้น' : 'Principal', formatCurrency(selectedLoan.principal), D_T.ink],
                        [`${lang === 'th' ? 'ดอก' : 'Interest'} @ ${selectedLoan.interestRate}%`, '+' + formatCurrency(selectedLoan.expectedInterest), D_T.mintDeep],
                        [lang === 'th' ? 'ค่าปรับ' : 'Penalty', formatCurrency(selectedLoan.penalty), D_T.mute],
                      ].map(([k, v, c], i, arr) => (
                        <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between',
                                          padding: '8px 0',
                                          borderBottom: i < arr.length - 1 ? `1px dashed ${D_T.line}` : 'none' }}>
                          <span style={{ fontSize: 12, color: D_T.ink2, fontWeight: 600 }}>{k}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: c as string, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                    marginTop: 12, paddingTop: 12, borderTop: `1.5px solid ${D_T.ink}` }}>
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                          {lang === 'th' ? 'รวม' : 'Total'}
                        </span>
                        <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                          {formatCurrency(selectedLoan.totalExpected)}
                        </span>
                      </div>
                    </div>

                    {/* Dates */}
                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ padding: '12px 12px', borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                        <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                          {lang === 'th' ? 'วันที่กู้' : 'Borrowed'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: mono }}>{selectedLoan.borrowDate}</div>
                      </div>
                      <div style={{ padding: '12px 12px', borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                        <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                          {lang === 'th' ? 'กำหนดคืน' : 'Due back'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, color: selectedLoan.isOverdue ? D_T.blushDeep : D_T.ink }}>
                          {selectedLoan.dueDate}
                        </div>
                      </div>
                    </div>

                    {/* Renewal history */}
                    {selectedLoan.historicalRenewalCount > 0 && (
                      <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: D_T.lavender + '40', border: `1px solid ${D_T.lavender}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: D_T.lavDeep }}>
                            {lang === 'th' ? 'ต่อสัญญา' : 'Renewed'} {selectedLoan.historicalRenewalCount} {lang === 'th' ? 'ครั้ง' : 'time(s)'}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: D_T.lavDeep, fontFamily: mono }}>
                            +{formatCurrency(selectedLoan.historicalRenewalInterest)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Note */}
                    {selectedLoan.note && (
                      <div style={{ marginTop: 16, padding: '8px 12px', borderRadius: 12,
                                    background: D_T.butter + '60', border: `1px solid ${D_T.line}` }}>
                        <div style={{ fontSize: 12, color: D_T.butterDeep, fontWeight: 700,
                                      letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                          {lang === 'th' ? 'หมายเหตุ' : 'Note'}
                        </div>
                        <div style={{ fontSize: 12, color: D_T.ink, lineHeight: 1.5 }}>{selectedLoan.note}</div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div style={{ marginTop: 24 }}>
                      <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                        {lang === 'th' ? 'ไทม์ไลน์' : 'Timeline'}
                      </div>
                      {[
                        [selectedLoan.borrowDate, lang === 'th' ? 'ปล่อยกู้' : 'Borrowed',
                          `${formatCurrency(selectedLoan.principal)} · ${selectedLoan.daysBorrowed} ${lang === 'th' ? 'วัน' : 'days'}`, 'done'],
                        [selectedLoan.dueDate, lang === 'th' ? 'กำหนดคืน' : 'Due back',
                          `${formatCurrency(selectedLoan.totalExpected)} ${lang === 'th' ? 'ที่คาด' : 'expected'}`,
                          selectedLoan.isPaid || selectedLoan.isRenewed || selectedLoan.isScam ? 'done' : selectedLoan.isOverdue ? 'done' : 'next'],
                        ['—', lang === 'th' ? 'ปิดบัญชี' : 'Settle',
                          lang === 'th' ? 'รับแล้ว · ต่อสัญญา · หนี้เสีย' : 'Mark paid · renew · default',
                          selectedLoan.isPaid || selectedLoan.isRenewed || selectedLoan.isScam ? 'done' : 'future'],
                      ].map(([date, title, sub, state], i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 12, position: 'relative' }}>
                          {i < 2 && <div style={{ position: 'absolute', left: 6, top: 18, bottom: -4, width: 1.5, background: D_T.line }} />}
                          <div style={{ width: 14, height: 14, borderRadius: 99, flexShrink: 0, marginTop: 4, position: 'relative', zIndex: 1,
                                        background: state === 'done' ? D_T.mintDeep : state === 'next' ? D_T.butter : D_T.surface,
                                        border: state === 'future' ? `1.5px dashed ${D_T.mute2}` : 'none' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: state === 'future' ? D_T.mute : D_T.ink }}>{title}</span>
                              <span style={{ fontSize: 12, color: D_T.mute, fontFamily: mono }}>{date}</span>
                            </div>
                            <div style={{ fontSize: 12, color: D_T.mute, marginTop: 2 }}>{sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Penalty toggle */}
                {!isEditingLoan && !selectedLoan.isPaid && !selectedLoan.isScam && !selectedLoan.isRenewed && (
                  <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hasPenalty ? 10 : 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: D_T.ink2, flex: 1 }}>
                        {lang === 'th' ? 'ค่าปรับ' : 'Penalty'}
                      </span>
                      <div style={{ display: 'flex', borderRadius: 99, overflow: 'hidden', border: `1px solid ${D_T.line}` }}>
                        <button onClick={() => setHasPenalty(false)}
                          style={{ padding: '4px 12px', background: !hasPenalty ? D_T.ink : 'transparent',
                                   color: !hasPenalty ? D_T.bg : D_T.ink2, fontSize: 12, fontWeight: 700,
                                   border: 'none', cursor: 'pointer', fontFamily: font }}>
                          {lang === 'th' ? 'ไม่มี' : 'None'}
                        </button>
                        <button onClick={() => { setPenaltyAmount(Math.max(1, selectedLoan.daysLate) * 200); setHasPenalty(true); }}
                          style={{ padding: '4px 12px', background: hasPenalty ? D_T.butter : 'transparent',
                                   color: hasPenalty ? D_T.butterDeep : D_T.ink2, fontSize: 12, fontWeight: 700,
                                   border: 'none', cursor: 'pointer', fontFamily: font }}>
                          {lang === 'th' ? 'มี' : 'Yes'}
                        </button>
                      </div>
                    </div>
                    {hasPenalty && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="number" value={penaltyAmount}
                          onChange={e => setPenaltyAmount(Math.max(0, parseInt(e.target.value) || 0))}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${D_T.butter}`,
                                   background: D_T.butter + '60', fontSize: 16, fontWeight: 700,
                                   color: D_T.butterDeep, outline: 'none', fontFamily: mono }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: D_T.butterDeep }}>฿</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action date */}
                {!isEditingLoan && !selectedLoan.isPaid && !selectedLoan.isScam && !selectedLoan.isRenewed && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: D_T.mute, whiteSpace: 'nowrap' }}>
                      {lang === 'th' ? 'วันที่ดำเนินการ' : 'Action date'}
                    </span>
                    <DatePicker selected={actionDate}
                      onChange={(date) => date && setActionDate(date)}
                      dateFormat="dd/MM/yyyy"
                      className="w-full"
                      onFocus={e => e.target.blur()} />
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 8,
                            borderTop: `1px solid ${D_T.line}`, background: D_T.surface }}>
                {isEditingLoan ? (
                  <button onClick={handleSaveEdit} disabled={isSyncing}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 999, background: D_T.ink,
                             color: D_T.bg, border: 'none', fontSize: 14, fontWeight: 700,
                             fontFamily: font, cursor: 'pointer', opacity: isSyncing ? 0.5 : 1 }}>
                    {isSyncing ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…') : (lang === 'th' ? 'บันทึกการเปลี่ยนแปลง' : 'Save changes')}
                  </button>
                ) : selectedLoan.isPaid || selectedLoan.isScam || selectedLoan.isRenewed || selectedLoan.isWithdrawn ? (
                  <div style={{ textAlign: 'center', fontSize: 12, color: D_T.mute, padding: '8px 0' }}>
                    <DChip tone={getLoanTone(selectedLoan)}>{getLoanStatusText(selectedLoan)}</DChip>
                    <div style={{ marginTop: 8 }}>{lang === 'th' ? 'รายการนี้ปิดแล้ว' : 'This loan is closed'}</div>
                  </div>
                ) : (
                  <>
                    <button onClick={() => setReminderLoan(selectedLoan)} className="lt-btn"
                      style={{ width: '100%', padding: '12px 0', borderRadius: 999, background: D_T.surface,
                               color: D_T.ink, border: `1px solid ${D_T.line}`, fontSize: 14, fontWeight: 700,
                               fontFamily: font, cursor: 'pointer', display: 'flex', alignItems: 'center',
                               justifyContent: 'center', gap: 8 }}>
                      <ChatCircleText size={18} weight="bold" aria-hidden="true" />
                      {lang === 'th' ? 'ส่งข้อความทวง' : 'Send reminder'}
                    </button>
                    <button onClick={() => handleUpdateStatus('ชำระแล้ว')}
                      style={{ width: '100%', padding: '12px 0', borderRadius: 999, background: D_T.ink,
                               color: D_T.bg, border: 'none', fontSize: 14, fontWeight: 700,
                               fontFamily: font, cursor: 'pointer' }}>
                      {lang === 'th' ? `รับเงินแล้ว ${formatCurrency(selectedLoan.totalExpected)}` : `Got paid ${formatCurrency(selectedLoan.totalExpected)}`}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: D_T.mute, whiteSpace: 'nowrap' }}>
                        {lang === 'th' ? 'เริ่มรอบใหม่' : 'Renew from'}
                      </span>
                      <DatePicker selected={renewStartDate}
                        onChange={(date) => date && setRenewStartDate(date)}
                        dateFormat="dd/MM/yyyy"
                        className="w-full"
                        onFocus={e => e.target.blur()} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleUpdateStatus('ต่อดอก')}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 999, background: D_T.lavender,
                                 color: D_T.lavDeep, border: 'none', fontSize: 12, fontWeight: 700,
                                 fontFamily: font, cursor: 'pointer' }}>
                        {lang === 'th' ? 'ต่อสัญญาอีกรอบ' : 'Renew for another period'}
                      </button>
                      <button onClick={() => setShowConfirmDefault(true)}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 999, background: D_T.blush,
                                 color: D_T.blushDeep, border: 'none', fontSize: 12, fontWeight: 700,
                                 fontFamily: font, cursor: 'pointer' }}>
                        {lang === 'th' ? 'บันทึกหนี้เสีย' : 'Mark as bad debt'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showExpandedTrend && (() => {
        const expDue = insightDate ? data.loans.filter(l => l.dueDate === insightDate) : [];
        const expPaid = insightDate ? data.loans.filter(l => l.actualDate === insightDate && (l.isPaid || l.isRenewed)) : [];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
                        alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center',
                        padding: isDesktop ? 20 : 0, background: 'rgba(27,31,42,.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => { setShowExpandedTrend(false); setInsightDate(null); }}>
            <div style={{ background: D_T.surface, width: '100%', maxWidth: isDesktop ? 940 : '100%',
                          maxHeight: isDesktop ? '90vh' : '92vh', overflow: 'hidden',
                          display: 'flex', flexDirection: 'column',
                          borderRadius: isDesktop ? 22 : '20px 20px 0 0',
                          boxShadow: '0 -8px 40px -12px rgba(27,31,42,.3)' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: isDesktop ? '18px 24px' : '14px 20px', borderBottom: `1px solid ${D_T.line}`,
                            background: D_T.surface2, display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {lang === 'th' ? 'กระแสเงินสด 30 วัน' : '30-day cashflow'}
                  </div>
                  <div style={{ fontSize: isDesktop ? 18 : 15, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2 }}>
                    {lang === 'th' ? 'การวิเคราะห์ขั้นสูง' : 'Advanced Analysis'}
                  </div>
                </div>
                <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => { setShowExpandedTrend(false); setInsightDate(null); }}
                  style={{ width: 32, height: 32, borderRadius: 99, background: 'rgba(27,31,42,.08)',
                           border: 'none', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}><X size={16} weight="bold" aria-hidden="true" /></button>
              </div>

              {/* Body */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden',
                            flexDirection: isDesktop ? 'row' : 'column' }}>

                {/* Left / Top: chart + date chips */}
                <div style={{ flexShrink: 0,
                              width: isDesktop ? '55%' : '100%',
                              maxHeight: isDesktop ? 'none' : 340,
                              padding: isDesktop ? '20px 24px' : '14px 18px',
                              borderRight: isDesktop ? `1px solid ${D_T.line}` : 'none',
                              borderBottom: isDesktop ? 'none' : `1px solid ${D_T.line}`,
                              display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

                  {/* Chart */}
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={trendData30} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                        onClick={(e: any) => { if (e?.activeLabel) setInsightDate(labelToFullDate.get(e.activeLabel) ?? e.activeLabel); }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={D_T.line} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: D_T.mute }} interval="preserveStartEnd" />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: D_T.mute }} width={46} />
                        <RechartsTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${D_T.line}`, fontFamily: font, fontSize: 12 }} />
                        <Bar dataKey="Expected" barSize={10} fill={D_T.line} radius={[3,3,0,0]} name={lang === 'th' ? 'คาด' : 'Expected'} />
                        <Line type="monotone" dataKey="Received" stroke={D_T.mintDeep} strokeWidth={2.5} dot={false}
                          activeDot={{ r: 5, fill: D_T.mintDeep, stroke: D_T.bg, strokeWidth: 2 }}
                          name={lang === 'th' ? 'รับจริง' : 'Received'} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Date chips */}
                  <div>
                    <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                                  textTransform: 'uppercase', marginBottom: 8 }}>
                      {lang === 'th' ? 'กดวันเพื่อดูรายละเอียด' : 'Tap a date to inspect'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {trendData30.map(d => {
                        const fullDate = labelToFullDate.get(d.date) ?? d.date;
                        const sel = insightDate === fullDate;
                        const hasData = d.Received > 0 || d.Expected > 0;
                        return (
                          <button key={d.date}
                            onClick={() => setInsightDate(sel ? null : fullDate)}
                            style={{ padding: '4px 8px', borderRadius: 8, border: sel ? 'none' : `1px solid ${D_T.line}`,
                                     cursor: 'pointer', fontFamily: mono, fontSize: 12, fontWeight: 700,
                                     background: sel ? D_T.ink : hasData ? D_T.mint + '55' : D_T.surface2,
                                     color: sel ? D_T.bg : hasData ? D_T.mintDeep : D_T.mute2,
                                     outline: 'none', transition: 'background 300ms cubic-bezier(0.22,1,0.36,1), color 300ms cubic-bezier(0.22,1,0.36,1)' }}>
                            {d.date}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right / Bottom: detail panel — fixed structure, no jump */}
                <div style={{ flex: 1, overflowY: 'auto', padding: isDesktop ? '20px 24px' : '14px 18px' }}>
                  {!insightDate ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  justifyContent: 'center', height: isDesktop ? '100%' : 100,
                                  textAlign: 'center', color: D_T.mute }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>☝️</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: D_T.ink2 }}>
                        {lang === 'th' ? 'กดวันด้านบนเพื่อดูรายละเอียด' : 'Select a date above to inspect'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Date badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                                    paddingBottom: 12, borderBottom: `1px solid ${D_T.line}` }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: D_T.lavender,
                                      color: D_T.lavDeep, display: 'grid', placeItems: 'center', fontSize: 14 }}>📅</div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{insightDate}</div>
                          <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                            Daily Insight
                          </div>
                        </div>
                        <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setInsightDate(null)}
                          style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 99,
                                   background: 'rgba(27,31,42,.06)', border: 'none', fontSize: 12, cursor: 'pointer' }}><X size={16} weight="bold" aria-hidden="true" /></button>
                      </div>

                      {/* Expected due */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                                      textTransform: 'uppercase', marginBottom: 8 }}>
                          {lang === 'th' ? 'ดอกที่คาด' : 'Expected due'}
                        </div>
                        {expDue.length === 0 ? (
                          <div style={{ fontSize: 12, color: D_T.mute, fontStyle: 'italic' }}>
                            {lang === 'th' ? 'ไม่มีรายการ' : 'None'}
                          </div>
                        ) : expDue.map(l => (
                          <div key={'exp-' + l.id} {...tap(() => { setInsightDate(null); setShowExpandedTrend(false); setSelectedLoan(l); })}
                            style={{ padding: '8px 12px', background: D_T.surface2, borderRadius: 8,
                                     border: `1px solid ${D_T.line}`, marginBottom: 4,
                                     display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                     cursor: 'pointer' }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</div>
                              <div style={{ fontSize: 12, color: D_T.mute }}>{l.id}</div>
                            </div>
                            <div style={{ fontFamily: mono, fontWeight: 700, color: D_T.mintDeep, fontSize: 12 }}>
                              +{formatCurrency(l.expectedInterest)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Payments received */}
                      <div>
                        <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                                      textTransform: 'uppercase', marginBottom: 8 }}>
                          {lang === 'th' ? 'รับจริง' : 'Received'}
                        </div>
                        {expPaid.length === 0 ? (
                          <div style={{ fontSize: 12, color: D_T.mute, fontStyle: 'italic' }}>
                            {lang === 'th' ? 'ไม่มีการชำระ' : 'None'}
                          </div>
                        ) : expPaid.map(l => (
                          <div key={'act-' + l.id} {...tap(() => { setInsightDate(null); setShowExpandedTrend(false); setSelectedLoan(l); })}
                            style={{ padding: '8px 12px', background: D_T.mint + '35', borderRadius: 8,
                                     border: `1px solid ${D_T.mint}`, marginBottom: 4,
                                     display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                     cursor: 'pointer' }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</div>
                              <DChip tone="mint">{getLoanStatusText(l)}</DChip>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontFamily: mono, fontWeight: 700, color: D_T.mintDeep, fontSize: 12 }}>
                                +{formatCurrency(l.paidInterest)}
                              </div>
                              <div style={{ fontSize: 12, color: D_T.mute }}>{formatCurrency(l.paidPrincipal)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {reminderLoan && !editingTemplate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'flex-end',
                      justifyContent: 'center', background: 'rgba(27,31,42,.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setReminderLoan(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="reminder-title"
            style={{ background: D_T.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 520,
                     maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'contain', padding: '24px 24px 32px',
                     boxShadow: '0 -12px 40px rgba(27,31,42,.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 500 }}>
                  {reminderLoan.name} · {reminderLoan.id}
                  {reminderLoan.isOverdue ? (lang === 'th' ? ` · ช้า ${reminderLoan.daysLate} วัน` : ` · ${reminderLoan.daysLate}d late`) : ''}
                </div>
                <div id="reminder-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                  {lang === 'th' ? 'ข้อความทวงหนี้' : 'Payment reminder'}
                </div>
              </div>
              <button onClick={() => setReminderLoan(null)} aria-label={lang === 'th' ? 'ปิด' : 'Close'}
                style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(27,31,42,.06)',
                         border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <X size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>

            <div style={{ padding: 16, borderRadius: 16, background: D_T.surface2, border: `1px solid ${D_T.line}`,
                          fontSize: 14, lineHeight: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          color: D_T.ink, userSelect: 'text' }}>
              {reminderText}
            </div>

            {reminderTemplate.includes('ใส่เลขบัญชี') && (
              <div style={{ fontSize: 12, color: D_T.blushDeep, marginTop: 8 }}>
                {lang === 'th' ? 'ยังไม่ได้ใส่เลขบัญชี กด "แก้ข้อความ" ด้านล่าง' : 'Bank details missing. Tap "Edit message" below.'}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
              <button onClick={copyReminder} className="lt-btn"
                style={{ padding: '12px 0', borderRadius: 12, background: D_T.ink, color: D_T.bg, border: 'none',
                         fontSize: 14, fontWeight: 600, fontFamily: font, cursor: 'pointer',
                         display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Copy size={18} weight="bold" aria-hidden="true" />
                {lang === 'th' ? 'คัดลอก' : 'Copy'}
              </button>
              <button onClick={shareReminderMessenger} className="lt-btn"
                style={{ padding: '12px 0', borderRadius: 12, background: '#0866FF', color: '#fff', border: 'none',
                         fontSize: 14, fontWeight: 600, fontFamily: font, cursor: 'pointer',
                         display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <MessengerLogo size={18} weight="fill" aria-hidden="true" />
                {lang === 'th' ? 'ส่งทาง Messenger' : 'Send via Messenger'}
              </button>
            </div>
            <button onClick={openTemplateEditor} className="lt-btn"
              style={{ width: '100%', marginTop: 8, padding: '12px 0', borderRadius: 12, background: 'none',
                       border: 'none', color: D_T.mute, fontSize: 14, fontWeight: 500, fontFamily: font, cursor: 'pointer' }}>
              {lang === 'th' ? 'แก้ข้อความ' : 'Edit message'}
            </button>
          </div>
        </div>
      )}

      {editingTemplate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, display: 'flex', alignItems: 'flex-end',
                      justifyContent: 'center', background: 'rgba(27,31,42,.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setEditingTemplate(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="template-title"
            style={{ background: D_T.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 520,
                     maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'contain', padding: '24px 24px 32px',
                     boxShadow: '0 -12px 40px rgba(27,31,42,.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div id="template-title" style={{ fontSize: 20, fontWeight: 600 }}>
                {lang === 'th' ? 'แก้ข้อความทวงหนี้' : 'Edit reminder message'}
              </div>
              <button onClick={() => setEditingTemplate(false)} aria-label={lang === 'th' ? 'ปิด' : 'Close'}
                style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(27,31,42,.06)',
                         border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <X size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <label htmlFor="template-input" style={{ fontSize: 14, fontWeight: 500, color: D_T.ink2 }}>
              {lang === 'th' ? 'ข้อความ' : 'Message'}
            </label>
            <textarea id="template-input" name="reminderTemplate" rows={9} value={templateDraft}
              onChange={e => setTemplateDraft(e.target.value)} autoComplete="off"
              style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 12, fontSize: 16, lineHeight: '24px',
                       border: `1px solid ${D_T.line}`, background: D_T.surface2, color: D_T.ink, fontFamily: font,
                       boxSizing: 'border-box', resize: 'vertical' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: D_T.mute, marginRight: 4 }}>
                {lang === 'th' ? 'แตะเพื่อแทรก:' : 'Tap to insert:'}
              </span>
              {['{ยอด}', '{ต้น}', '{ดอก}', '{ชื่อ}', '{กำหนด}'].map(tok => (
                <button key={tok} type="button" onClick={() => setTemplateDraft(d => d + tok)}
                  style={{ padding: '4px 8px', borderRadius: 999, border: `1px solid ${D_T.line}`, background: D_T.surface,
                           fontSize: 12, fontWeight: 600, color: D_T.ink2, cursor: 'pointer', fontFamily: font }}>{tok}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: D_T.mute, marginTop: 8, lineHeight: '16px' }}>
              {lang === 'th'
                ? '{ยอด} = ต้น + ดอก + ค่าปรับ ของรายการนั้น เช่น 4050 · ข้อความเก็บบนเซิร์ฟเวอร์ ไม่อยู่ในโค้ด'
                : '{ยอด} = principal + interest + penalty, e.g. 4050. Stored on the server, not in the code.'}
            </div>
            <button onClick={saveTemplate} disabled={isSavingTemplate} className="lt-btn"
              style={{ width: '100%', marginTop: 24, padding: '12px 16px', borderRadius: 12, border: 'none',
                       background: D_T.ink, color: D_T.bg, fontSize: 16, fontWeight: 600, fontFamily: font,
                       cursor: isSavingTemplate ? 'default' : 'pointer', opacity: isSavingTemplate ? 0.4 : 1 }}>
              {isSavingTemplate ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…') : (lang === 'th' ? 'บันทึกข้อความ' : 'Save message')}
            </button>
          </div>
        </div>
      )}

      {showReconcile && data && (() => {
        const bank = parseFloat(bankInput.replace(/,/g, ''));
        const valid = Number.isFinite(bank) && bank >= 0;
        const diff = valid ? bank - data.summary.available : 0;
        const newCapital = Math.round(CAPITAL + diff);
        const lastBank = capitalCfg.history?.find(h => h.bankBalance !== undefined);
        const row = (label: string, value: string, color: string = D_T.ink) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: 14, color: D_T.ink2 }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: mono, color }}>{value}</span>
          </div>
        );
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'flex-end',
                        justifyContent: 'center', background: 'rgba(27,31,42,.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowReconcile(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="reconcile-title"
              style={{ background: D_T.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 520,
                        maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'contain', padding: '24px 24px 32px',
                        boxShadow: '0 -12px 40px rgba(27,31,42,.2)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 500 }}>
                    {lang === 'th' ? 'เทียบกับยอดในแอปธนาคาร' : 'Compare with your banking app'}
                  </div>
                  <div id="reconcile-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                    {lang === 'th' ? 'เช็คกับบัญชีจริง' : 'Match bank balance'}
                  </div>
                </div>
                <button onClick={() => setShowReconcile(false)} aria-label={lang === 'th' ? 'ปิด' : 'Close'}
                  style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(27,31,42,.06)',
                           border: 'none', fontSize: 14, cursor: 'pointer' }}><X size={16} weight="bold" aria-hidden="true" /></button>
              </div>

              <label htmlFor="bank-input" style={{ fontSize: 14, fontWeight: 500, color: D_T.ink2 }}>
                {lang === 'th' ? 'เงินในบัญชีตอนนี้ (บาท)' : 'Bank balance now (THB)'}
              </label>
              <input id="bank-input" inputMode="decimal" autoFocus={isDesktop} autoComplete="off" name="bankBalance" value={bankInput}
                onChange={e => setBankInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter' && valid && !isSavingCapital) applyReconcile(); }}
                style={{ width: '100%', marginTop: 8, padding: '12px 16px', borderRadius: 12, fontSize: 24,
                         fontWeight: 600, fontFamily: mono, border: `1px solid ${valid ? D_T.line : D_T.blushDeep}`,
                         background: D_T.surface2, color: D_T.ink, outline: 'none', boxSizing: 'border-box' }} />
              {!valid && bankInput !== '' && (
                <div style={{ fontSize: 12, color: D_T.blushDeep, marginTop: 4 }}>
                  {lang === 'th' ? 'กรอกเป็นตัวเลขเท่านั้น' : 'Numbers only'}
                </div>
              )}

              <div style={{ marginTop: 16, padding: '8px 16px', borderRadius: 12, background: D_T.surface2 }}>
                {row(lang === 'th' ? 'แอปคำนวณว่ามี' : 'App says you have', `${formatCurrency(data.summary.available)}`)}
                {row(lang === 'th' ? 'ส่วนต่าง' : 'Difference',
                     valid ? `${diff >= 0 ? '+' : '−'}${formatCurrency(Math.abs(diff))}` : '–',
                     diff === 0 ? D_T.mintDeep : D_T.blushDeep)}
                {row(lang === 'th' ? 'ทุนตั้งต้น' : 'Starting capital',
                     diff === 0 || !valid ? `${formatCurrency(CAPITAL)}` : `${formatCurrency(CAPITAL)} → ${formatCurrency(newCapital)}`)}
                {row(lang === 'th' ? 'กำไรที่ได้แล้ว (ไม่เปลี่ยน)' : 'Profit earned (unchanged)', `${formatCurrency(data.summary.paidInterest)}`, D_T.mintDeep)}
              </div>

              <div style={{ fontSize: 12, color: D_T.mute, marginTop: 12, lineHeight: '16px' }}>
                {lang === 'th'
                  ? 'แอปจะปรับทุนตั้งต้นให้ยอดตรงกัน รายการกู้และกำไรไม่ถูกแก้ ใช้ได้ทั้งมือถือและคอม'
                  : 'The app adjusts starting capital so the numbers match. Loans and profit stay as they are.'}
                {lastBank && (
                  <div style={{ marginTop: 4 }}>
                    {lang === 'th' ? 'ปรับล่าสุด' : 'Last matched'} {new Date(lastBank.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {formatCurrency(lastBank.bankBalance ?? 0)}
                  </div>
                )}
              </div>

              <button onClick={applyReconcile} disabled={!valid || diff === 0 || isSavingCapital}
                className="lt-btn"
                style={{ width: '100%', marginTop: 24, padding: '12px 16px', borderRadius: 12, border: 'none',
                         background: D_T.ink, color: D_T.bg, fontSize: 16, fontWeight: 600, fontFamily: font,
                         cursor: !valid || diff === 0 || isSavingCapital ? 'default' : 'pointer',
                         opacity: !valid || diff === 0 || isSavingCapital ? 0.4 : 1 }}>
                {isSavingCapital
                  ? (lang === 'th' ? 'กำลังบันทึก' : 'Saving')
                  : diff === 0 && valid
                    ? (lang === 'th' ? 'ยอดตรงกันแล้ว' : 'Already matching')
                    : (lang === 'th' ? 'ปรับให้ตรงกับบัญชี' : 'Match this balance')}
              </button>
            </div>
          </div>
        );
      })()}

      {showReserveBreakdown && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'flex-end',
                      justifyContent: 'center', background: 'rgba(27,31,42,.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowReserveBreakdown(false)}>
          <div style={{ background: D_T.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 520,
                        maxHeight: '85vh', overflow: 'hidden', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 -12px 40px rgba(27,31,42,.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px 16px', borderBottom: `1px solid ${D_T.line}`, background: D_T.surface2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {lang === 'th' ? 'ดอกสำรองล็อกอยู่' : 'Interest Reserve'}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                    {lang === 'th' ? 'เบิกได้จริง' : 'Safe to Withdraw'}
                  </div>
                </div>
                <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setShowReserveBreakdown(false)}
                  style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                           border: 'none', fontSize: 14, cursor: 'pointer' }}><X size={16} weight="bold" aria-hidden="true" /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                {[
                  [lang === 'th' ? 'ยอดว่าง' : 'Available', formatCurrency(data?.summary.available ?? 0), D_T.ink],
                  [lang === 'th' ? 'สำรองล็อก' : 'Reserved', formatCurrency(reserveData.totalLocked), D_T.blushDeep],
                  [lang === 'th' ? 'เบิกได้' : 'Safe', formatCurrency(reserveData.safeWithdrawable), D_T.mintDeep],
                  [lang === 'th' ? 'Coverage Ratio' : 'Coverage Ratio', `${reserveData.coverageRatio.toFixed(1)}%`,
                    reserveData.coverageRatio >= 100 ? D_T.mintDeep : reserveData.coverageRatio >= 50 ? D_T.butterDeep : D_T.blushDeep],
                ].map(([label, val, color]) => (
                  <div key={label as string} style={{ padding: '8px 12px', borderRadius: 8, background: D_T.surface }}>
                    <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, color: color as string, marginTop: 2 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '12px 24px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* กลุ่มเสี่ยง */}
              {reserveData.items.filter(i => !i.isBreakEven).length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: D_T.blushDeep, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                    {lang === 'th' ? 'ยังเสี่ยง — ดอกยังไม่ถึงต้น' : 'At risk — interest below principal'}
                  </div>
                  {reserveData.items.filter(i => !i.isBreakEven).map(({ loan: l, locked, excess, recoveryPct, remaining, renewalsNeeded, isBreakEven, isLongTerm, approxDaysRenewing }) => (
                    <div key={l.id} style={{ padding: '12px 12px', borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</span>
                            {isLongTerm && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: D_T.blushDeep, background: D_T.blush + '40',
                                             padding: '2px 4px', borderRadius: 99, letterSpacing: '.04em' }}>
                                {lang === 'th' ? 'ระยะยาว' : 'LONG-TERM'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: D_T.mute, marginTop: 0 }}>
                            {lang === 'th' ? 'ต่อดอกแล้ว' : 'Renewed'} {l.historicalRenewalCount} {lang === 'th' ? 'ครั้ง' : 'x'}
                            {isLongTerm && ` · ~${approxDaysRenewing} ${lang === 'th' ? 'วัน' : 'd'}`} · {l.id}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: mono, color: D_T.blushDeep }}>
                            {formatCurrency(locked)}
                          </div>
                          <div style={{ fontSize: 12, color: D_T.mute, marginTop: 0 }}>
                            {lang === 'th' ? 'สำรองไว้' : 'reserved'}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ height: 6, borderRadius: 99, background: D_T.line, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${recoveryPct}%`,
                                        background: recoveryPct >= 60 ? D_T.butterDeep : D_T.blushDeep,
                                        transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: D_T.mute }}>
                            {lang === 'th' ? 'ดอกสะสม' : 'Interest earned'} {formatCurrency(l.historicalRenewalInterest)}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700,
                                         color: recoveryPct >= 60 ? D_T.butterDeep : D_T.blushDeep }}>
                            {recoveryPct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        <div style={{ padding: '8px 8px', borderRadius: 8, background: D_T.surface }}>
                          <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                            {lang === 'th' ? 'ต้นยังขาด' : 'To break-even'}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: mono, marginTop: 2, color: D_T.ink }}>
                            {formatCurrency(remaining)}
                          </div>
                        </div>
                        <div style={{ padding: '8px 8px', borderRadius: 8, background: D_T.surface }}>
                          <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                            {lang === 'th' ? 'ต่ออีกกี่ครั้ง' : 'Renewals left'}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2,
                                        color: renewalsNeeded <= 2 ? D_T.butterDeep : D_T.blushDeep }}>
                            {lang === 'th' ? `อีก ${renewalsNeeded} ครั้ง` : `${renewalsNeeded} more`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* กลุ่มปลอดภัย */}
              {reserveData.items.filter(i => i.isBreakEven).length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: D_T.mintDeep, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                                 marginTop: reserveData.items.filter(i => !i.isBreakEven).length > 0 ? 10 : 2, marginBottom: 2 }}>
                    {lang === 'th' ? 'ปลอดภัย — ดอกเกินต้นแล้ว' : 'Safe — interest exceeds principal'}
                  </div>
                  {reserveData.items.filter(i => i.isBreakEven).map(({ loan: l, locked, excess, recoveryPct, remaining, renewalsNeeded, isBreakEven, isLongTerm, approxDaysRenewing }) => (
                    <div key={l.id} style={{ padding: '12px 12px', borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.mint}60` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</span>
                            {isLongTerm && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: D_T.butterDeep, background: D_T.butter + '60',
                                             padding: '2px 4px', borderRadius: 99, letterSpacing: '.04em' }}>
                                {lang === 'th' ? 'ระยะยาว' : 'LONG-TERM'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: D_T.mute, marginTop: 0 }}>
                            {lang === 'th' ? 'ต่อดอกแล้ว' : 'Renewed'} {l.historicalRenewalCount} {lang === 'th' ? 'ครั้ง' : 'x'}
                            {isLongTerm && ` · ~${approxDaysRenewing} ${lang === 'th' ? 'วัน' : 'd'}`} · {l.id}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: mono, color: D_T.blushDeep }}>
                            {formatCurrency(locked)}
                          </div>
                          <div style={{ fontSize: 12, color: D_T.mute, marginTop: 0 }}>
                            {lang === 'th' ? 'สำรองไว้' : 'reserved'}
                          </div>
                          {excess > 0 && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: D_T.mintDeep, marginTop: 2 }}>
                              +{formatCurrency(excess)} {lang === 'th' ? 'เบิกได้' : 'withdrawable'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ height: 6, borderRadius: 99, background: D_T.line, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: '100%',
                                        background: D_T.mintDeep, transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: D_T.mute }}>
                            {lang === 'th' ? 'ดอกสะสม' : 'Interest earned'} {formatCurrency(l.historicalRenewalInterest)}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: D_T.mintDeep }}>
                            {recoveryPct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: '8px 8px', borderRadius: 8, background: D_T.surface, textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: D_T.mintDeep }}>
                          {lang === 'th' ? 'ดอกคุ้มทุนแล้ว — ต้นสำรองถึงปิดยอด' : 'Break-even reached — principal reserved until closure'}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {reserveData.items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: D_T.mute, fontSize: 12 }}>
                  {lang === 'th' ? 'ไม่มียอดล็อก' : 'No locked reserves'}
                </div>
              )}

              {/* ── ประวัติหนี้เสีย ── */}
              {reserveData.scamItems.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: D_T.blushDeep, fontWeight: 700,
                                letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {lang === 'th' ? 'ประวัติหนี้เสีย' : 'Default history'}
                  </div>

                  {/* Summary bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    {[
                      [lang === 'th' ? 'สูญต้น' : 'Principal lost', formatCurrency(reserveData.totalScamPrincipal), D_T.blushDeep],
                      [lang === 'th' ? 'ดอกดูดซับ' : 'Interest offset', formatCurrency(reserveData.totalInterestAbsorbed), D_T.butterDeep],
                      [lang === 'th' ? 'ขาดทุนสุทธิ' : 'Net loss', formatCurrency(reserveData.totalNetLoss), reserveData.totalNetLoss <= 0 ? D_T.mintDeep : D_T.blushDeep],
                    ].map(([label, val, color]) => (
                      <div key={label as string} style={{ padding: '8px 12px', borderRadius: 8,
                                  background: D_T.blush + '30', border: `1px solid ${D_T.blush}` }}>
                        <div style={{ fontSize: 12, color: D_T.blushDeep, fontWeight: 700,
                                      letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: mono,
                                      color: color as string, marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* รายคน */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {reserveData.scamItems.map((sc, idx) => (
                      <div key={sc.id} style={{ padding: '12px 12px', borderRadius: 12,
                                  background: D_T.surface2, border: `1px solid ${D_T.blush}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{sc.name}</div>
                            <div style={{ fontSize: 12, color: D_T.mute, marginTop: 0 }}>
                              {sc.id} · {lang === 'th' ? 'ต่อดอก' : 'renewed'} {sc.renewalCount} {lang === 'th' ? 'ครั้งก่อนบิด' : 'x before default'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: D_T.mute }}>{lang === 'th' ? 'ขาดทุนสุทธิ' : 'Net loss'}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: mono,
                                          color: sc.netLoss <= 0 ? D_T.mintDeep : D_T.blushDeep }}>
                              {sc.netLoss <= 0 ? '+' : '-'}{formatCurrency(Math.abs(sc.netLoss))}
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: D_T.blush + '60', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99,
                                        width: `${Math.min(100, sc.principal > 0 ? (sc.interestAbsorbed / sc.principal) * 100 : 0)}%`,
                                        background: sc.interestAbsorbed >= sc.principal ? D_T.mintDeep : D_T.butterDeep }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: D_T.mute }}>
                            {lang === 'th' ? 'ต้นสูญ' : 'Lost'} {formatCurrency(sc.principal)}
                          </span>
                          <span style={{ fontSize: 12, color: D_T.butterDeep, fontWeight: 700 }}>
                            {lang === 'th' ? 'ดอกดูดซับ' : 'Offset'} {formatCurrency(sc.interestAbsorbed)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 16, background: 'rgba(27,31,42,.5)',
                      backdropFilter: 'blur(4px)' }}
          onClick={() => setShowWithdrawModal(false)}>
          <div style={{ background: D_T.surface, borderRadius: 24, width: '100%', maxWidth: 480,
                        overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${D_T.line}`,
                          background: D_T.surface2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'ถอนเงิน' : 'Withdraw'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 4 }}>
                  {lang === 'th' ? 'บันทึกการเบิกเงิน' : 'Record a payout'}
                </div>
              </div>
              <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setShowWithdrawModal(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer' }}><X size={16} weight="bold" aria-hidden="true" /></button>
            </div>
            <form onSubmit={handleWithdrawSubmit} style={{ padding: '24px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'จำนวนเงิน' : 'Amount'}
                </label>
                <div style={{ padding: '12px 12px', borderRadius: 12, background: D_T.surface2, border: `1.5px solid ${D_T.ink}`,
                              display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>฿</span>
                  <input type="number" required min="1" value={withdrawForm.principal}
                    onChange={e => setWithdrawForm({ ...withdrawForm, principal: e.target.value })}
                    placeholder="0"
                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 24, fontWeight: 700,
                             letterSpacing: '-.02em', color: D_T.ink, outline: 'none', fontFamily: mono,
                             marginLeft: 4, fontVariantNumeric: 'tabular-nums' }} />
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {[100, 500, 1000, 2000, 5000].map(amt => (
                    <button key={amt} type="button"
                      onClick={() => setWithdrawForm(f => ({ ...f, principal: String(Math.max(0, parseFloat(f.principal || '0') + amt)) }))}
                      style={{ padding: '4px 8px', borderRadius: 999, background: D_T.blush, color: D_T.blushDeep,
                               fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: font }}>
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'วันที่' : 'Date'}
                </label>
                <DatePicker selected={withdrawForm.date}
                  onChange={(date: Date | null) => setWithdrawForm({ ...withdrawForm, date: date ?? new Date() })}
                  dateFormat="dd/MM/yyyy" className="w-full" onFocus={e => e.target.blur()} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Note (optional)'}
                </label>
                <input type="text" value={withdrawForm.name}
                  onChange={e => setWithdrawForm({ ...withdrawForm, name: e.target.value })}
                  placeholder={lang === 'th' ? 'ค่าใช้จ่าย…' : 'Expense…'}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 12, border: `1px solid ${D_T.line}`,
                           background: D_T.surface2, fontSize: 16, color: D_T.ink, outline: 'none',
                           fontFamily: font, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: `1px solid ${D_T.line}` }}>
                <button type="button" onClick={() => setShowWithdrawModal(false)}
                  style={{ padding: '12px 16px', borderRadius: 999, background: D_T.surface,
                           color: D_T.ink, border: `1px solid ${D_T.line}`, fontSize: 12, fontWeight: 700,
                           cursor: 'pointer', fontFamily: font }}>
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button type="submit" disabled={isSyncing}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 999, background: D_T.ink,
                           color: D_T.bg, border: 'none', fontSize: 12, fontWeight: 700,
                           cursor: 'pointer', fontFamily: font, opacity: isSyncing ? 0.5 : 1 }}>
                  {isSyncing ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…') : (lang === 'th' ? 'ยืนยันการเบิก' : 'Confirm payout')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewLoanModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 16, background: 'rgba(27,31,42,.5)',
                      backdropFilter: 'blur(4px)' }}
          onClick={() => setShowNewLoanModal(false)}>
          <div style={{ background: D_T.surface, borderRadius: 24, width: '100%', maxWidth: 540,
                        overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)',
                        maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${D_T.line}`,
                          background: D_T.surface2, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'สินเชื่อใหม่' : 'New loan'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 4 }}>
                  {lang === 'th' ? 'ปล่อยกู้ให้ใคร' : 'Lend to someone'}
                </div>
                <div style={{ fontSize: 12, color: D_T.mute, marginTop: 4 }}>
                  {lang === 'th' ? 'แค่ 3 ช่อง ระบบคำนวณดอกและกำหนดให้' : 'Three details. Pocket figures out the rest.'}
                </div>
              </div>
              <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setShowNewLoanModal(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer', alignSelf: 'flex-start' }}><X size={16} weight="bold" aria-hidden="true" /></button>
            </div>
            {/* Form */}
            <form onSubmit={handleCreateNewLoan} style={{ padding: '24px 24px 12px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'ใครจะกู้' : "Who's borrowing"}
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="text" required value={newLoanForm.name}
                    onChange={e => setNewLoanForm({ ...newLoanForm, name: e.target.value })}
                    placeholder={lang === 'th' ? 'ชื่อผู้กู้' : 'Borrower name'}
                    autoComplete="off"
                    style={{ width: '100%', padding: '12px 12px', borderRadius: 12,
                             border: newLoanForm.name ? `1.5px solid ${D_T.ink}` : `1px solid ${D_T.line}`,
                             background: D_T.surface2, fontSize: 16, fontWeight: 600, color: D_T.ink,
                             outline: 'none', fontFamily: font, boxSizing: 'border-box' }} />
                  {/* Autocomplete dropdown */}
                  {newLoanForm.name.length > 0 && (() => {
                    const matches = allBorrowerNames.filter(n => n.toLowerCase().includes(newLoanForm.name.toLowerCase()) && n.toLowerCase() !== newLoanForm.name.toLowerCase());
                    if (matches.length === 0) return null;
                    return (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                                    background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 12,
                                    boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden' }}>
                        {matches.slice(0, 5).map(name => {
                          const idx = name.toLowerCase().indexOf(newLoanForm.name.toLowerCase());
                          return (
                            <div key={name} onMouseDown={() => setNewLoanForm(f => ({ ...f, name }))}
                              style={{ padding: '12px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                       color: D_T.ink, borderBottom: `1px solid ${D_T.line2}`,
                                       display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, color: D_T.mute, fontWeight: 500, width: 20, textAlign: 'center' }}>
                                {borrowerStats.find(b => b.name === name) ? (() => { const s = borrowerStats.find(b => b.name === name)!; return s.hasScam ? '⚠' : s.totalRenewals >= 6 ? '★' : s.totalRenewals >= 3 ? '◈' : '○'; })() : '○'}
                              </span>
                              <span>
                                {name.slice(0, idx)}<strong style={{ color: D_T.mintDeep }}>{name.slice(idx, idx + newLoanForm.name.length)}</strong>{name.slice(idx + newLoanForm.name.length)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Amount + days */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    {lang === 'th' ? 'เงินต้น' : 'Principal'}
                  </label>
                  <div style={{ padding: '12px 12px', borderRadius: 12, background: D_T.surface2,
                                border: `1px solid ${D_T.line}`, display: 'flex', alignItems: 'baseline', overflow: 'hidden' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, flexShrink: 0 }}>฿</span>
                    <input type="number" required min="1" value={newLoanForm.principal}
                      onChange={e => setNewLoanForm({ ...newLoanForm, principal: e.target.value })}
                      style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 20, fontWeight: 700,
                               letterSpacing: '-.02em', color: D_T.ink, outline: 'none', fontFamily: mono,
                               marginLeft: 4, fontVariantNumeric: 'tabular-nums', width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {['500', '1000', '1500', '2000', '3000'].map((p, i) => (
                      <span key={p} {...tap(() => setNewLoanForm(f => ({ ...f, principal: p })))}
                        style={{ padding: '4px 8px', borderRadius: 999, cursor: 'pointer',
                                 background: newLoanForm.principal === p ? D_T.ink : D_T.surface2,
                                 color: newLoanForm.principal === p ? D_T.bg : D_T.ink2,
                                 fontSize: 12, fontWeight: 700, border: newLoanForm.principal === p ? 'none' : `1px solid ${D_T.line}` }}>
                        {parseInt(p) >= 1000 ? (parseInt(p)/1000) + 'k' : p}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    {lang === 'th' ? 'นานเท่าไหร่' : 'For how long'}
                  </label>
                  <div style={{ padding: '8px 8px 8px 12px', borderRadius: 12, background: D_T.surface2,
                                border: `1px solid ${D_T.line}`, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                    <input type="number" min="1" value={newLoanForm.daysBorrowed}
                      onChange={e => handleDaysChange(Number(e.target.value))}
                      style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 20, fontWeight: 700,
                               letterSpacing: '-.02em', color: D_T.ink, outline: 'none', fontFamily: mono,
                               fontVariantNumeric: 'tabular-nums', minWidth: 0 }} />
                    <span style={{ fontSize: 12, color: D_T.mute }}>{lang === 'th' ? 'วัน' : 'd'}</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button type="button" onClick={() => handleDaysChange(newLoanForm.daysBorrowed - 1)}
                        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${D_T.line}`,
                                 background: D_T.surface, color: D_T.ink, fontSize: 14, fontWeight: 700,
                                 cursor: 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1 }}>−</button>
                      <button type="button" onClick={() => handleDaysChange(newLoanForm.daysBorrowed + 1)}
                        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${D_T.line}`,
                                 background: D_T.surface, color: D_T.ink, fontSize: 14, fontWeight: 700,
                                 cursor: 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1 }}>+</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {[3, 5, 7].map(d => (
                      <span key={d} {...tap(() => handleDaysChange(d))}
                        style={{ padding: '4px 12px', borderRadius: 999, cursor: 'pointer',
                                 background: newLoanForm.daysBorrowed === d ? D_T.ink : D_T.surface2,
                                 color: newLoanForm.daysBorrowed === d ? D_T.bg : D_T.ink2,
                                 fontSize: 12, fontWeight: 700, border: newLoanForm.daysBorrowed === d ? 'none' : `1px solid ${D_T.line}` }}>
                        {d}{lang === 'th' ? 'ว' : 'd'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Start date */}
              <div>
                <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'วันที่เริ่ม' : 'Start date'}
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <DatePicker selected={newLoanForm.borrowDate} onChange={handleBorrowDateChange} dateFormat="dd/MM/yyyy" className="w-full" onFocus={e => e.target.blur()} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <DatePicker selected={newLoanForm.dueDate} onChange={handleDueDateChange} dateFormat="dd/MM/yyyy" className="w-full" onFocus={e => e.target.blur()} />
                  </div>
                </div>
              </div>

              {/* Interest rate */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {lang === 'th' ? 'อัตราดอกเบี้ย' : 'Interest rate'}
                  </label>
                  <span style={{ fontSize: 12, color: D_T.mute }}>{lang === 'th' ? 'ต่อรอบสัญญา' : 'per loan period'}</span>
                </div>
                <div style={{ padding: '12px 12px', borderRadius: 12, background: D_T.mint,
                              display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="number" min="0" value={newLoanForm.interestRate}
                    onChange={e => setNewLoanForm({ ...newLoanForm, interestRate: Number(e.target.value) })}
                    style={{ width: 60, border: 'none', background: 'transparent', fontSize: 20, fontWeight: 700,
                             letterSpacing: '-.02em', color: D_T.ink, outline: 'none', fontFamily: mono }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: D_T.mintDeep }}>%</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: D_T.mintDeep, marginLeft: 'auto' }}>
                    ≈ {formatCurrency((parseFloat(newLoanForm.principal || '0') * newLoanForm.interestRate) / 100)}
                  </span>
                </div>
              </div>

              {/* Preview */}
              <div style={{ padding: 16, borderRadius: 12, background: D_T.surface2, border: `1px dashed ${D_T.line}` }}>
                <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {lang === 'th' ? 'ตัวอย่าง' : "Here's how it'll look"}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {([
                    [lang === 'th' ? 'คุณให้' : 'You give', formatCurrency(parseFloat(newLoanForm.principal || '0')), D_T.ink],
                    [lang === 'th' ? 'เขาคืน' : 'They owe', formatCurrency(parseFloat(newLoanForm.principal || '0') + (parseFloat(newLoanForm.principal || '0') * newLoanForm.interestRate) / 100), D_T.ink],
                    [lang === 'th' ? 'กำหนด' : 'Due', newLoanForm.dueDate.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' }), D_T.mintDeep],
                  ] as [string, string, string][]).map(([lbl, v, c]) => (
                    <div key={lbl}>
                      <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 600 }}>{lbl}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: c, marginTop: 4,
                                    letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note / Remark */}
              <div>
                <label style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                                 textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Note (optional)'}
                </label>
                <textarea rows={2} value={newLoanForm.note}
                  onChange={e => setNewLoanForm({ ...newLoanForm, note: e.target.value })}
                  placeholder={lang === 'th' ? 'เพิ่มหมายเหตุหรือรายละเอียดเพิ่มเติม…' : 'Add a note or extra details…'}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 12,
                           border: `1px solid ${D_T.line}`, background: D_T.surface2,
                           fontSize: 16, color: D_T.ink, outline: 'none', fontFamily: font,
                           boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            </form>
            {/* Footer */}
            <div style={{ padding: '16px 24px 24px', display: 'flex', gap: 8,
                          borderTop: `1px solid ${D_T.line}`, background: D_T.surface2 }}>
              <button type="button" onClick={() => setShowNewLoanModal(false)}
                style={{ padding: '12px 16px', borderRadius: 999, background: D_T.surface,
                         color: D_T.ink, border: `1px solid ${D_T.line}`, fontSize: 12, fontWeight: 700,
                         cursor: 'pointer', fontFamily: font }}>
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button onClick={handleCreateNewLoan} disabled={isSyncing || !newLoanForm.name}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 999, background: D_T.ink,
                         color: D_T.bg, border: 'none', fontSize: 12, fontWeight: 700,
                         cursor: 'pointer', fontFamily: font, opacity: isSyncing || !newLoanForm.name ? 0.5 : 1 }}>
                {isSyncing ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…') :
                  newLoanForm.name ? (lang === 'th' ? `ส่งให้ ${newLoanForm.name} →` : `Hand ${newLoanForm.name} ${formatCurrency(parseFloat(newLoanForm.principal || '0'))} →`) :
                  (lang === 'th' ? 'กรุณาใส่ชื่อผู้กู้' : 'Enter a borrower name')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 16, background: 'rgba(27,31,42,.5)',
                      backdropFilter: 'blur(4px)' }}
          onClick={() => setShowNotifModal(false)}>
          <div style={{ background: D_T.surface, borderRadius: 24, width: '100%', maxWidth: 400,
                        overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${D_T.line}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: D_T.surface2 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {lang === 'th' ? 'การแจ้งเตือน' : 'Notifications'}
              </div>
              <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setShowNotifModal(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer' }}><X size={16} weight="bold" aria-hidden="true" /></button>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 12, textAlign: 'center',
                            background: isSubscribed ? D_T.mint + '40' : notifPermission === 'denied' ? D_T.blush + '40' : D_T.surface2,
                            border: `1px solid ${isSubscribed ? D_T.mint : notifPermission === 'denied' ? D_T.blush : D_T.line}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isSubscribed ? D_T.mintDeep : notifPermission === 'denied' ? D_T.blushDeep : D_T.ink2 }}>
                  {isSubscribed ? (lang === 'th' ? '🔔 เปิดใช้งานแล้ว' : '🔔 Notifications enabled') :
                   notifPermission === 'denied' ? (lang === 'th' ? '🚫 ถูกบล็อก' : '🚫 Blocked by browser') :
                   (lang === 'th' ? '🔕 ปิดอยู่' : '🔕 Not enabled')}
                </div>
              </div>
              {isSubscribed && (
                <div>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {lang === 'th' ? 'ทดสอบ' : 'Test'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => handleTestNotif('morning')} disabled={isSendingTestNotif}
                      style={{ padding: '8px 0', borderRadius: 12, background: D_T.lavender, color: D_T.lavDeep,
                               border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'เช้า' : 'Morning'}
                    </button>
                    <button onClick={() => handleTestNotif('afternoon')} disabled={isSendingTestNotif}
                      style={{ padding: '8px 0', borderRadius: 12, background: D_T.lavender, color: D_T.lavDeep,
                               border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'บ่าย' : 'Afternoon'}
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!isSubscribed && notifPermission !== 'denied' && (
                  <button onClick={handleEnableNotif}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 999, background: D_T.ink,
                             color: D_T.bg, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                    {lang === 'th' ? 'เปิดการแจ้งเตือน' : 'Enable notifications'}
                  </button>
                )}
                {isSubscribed && (
                  <button onClick={handleDisableNotif}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 999, background: D_T.blush,
                             color: D_T.blushDeep, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                    {lang === 'th' ? 'ปิดการแจ้งเตือน' : 'Disable notifications'}
                  </button>
                )}
                <button onClick={() => setShowNotifModal(false)}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 999, background: D_T.surface2,
                           color: D_T.ink2, border: `1px solid ${D_T.line}`, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                  {lang === 'th' ? 'ปิด' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showFabMenu && (
          <motion.div className="md:hidden"
            style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowFabMenu(false)}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,42,.6)', backdropFilter: 'blur(4px)' }} />
            <motion.div style={{ position: 'relative', padding: '0 24px 96px', display: 'flex', flexDirection: 'column', gap: 12 }}
              initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowFabMenu(false); setShowNewLoanModal(true); }}
                style={{ width: '100%', padding: '16px 0', borderRadius: 16, background: D_T.ink,
                         color: D_T.bg, border: 'none', fontSize: 14, fontWeight: 700,
                         cursor: 'pointer', fontFamily: font, boxShadow: '0 8px 24px rgba(27,31,42,.3)' }}>
                {lang === 'th' ? '+ ปล่อยกู้' : '+ Lend money'}
              </button>
              <button onClick={() => { setShowFabMenu(false); setShowWithdrawModal(true); }}
                style={{ width: '100%', padding: '16px 0', borderRadius: 16, background: D_T.surface,
                         color: D_T.ink, border: `1px solid ${D_T.line}`, fontSize: 14, fontWeight: 700,
                         cursor: 'pointer', fontFamily: font }}>
                {lang === 'th' ? 'ถอนเงิน' : 'Withdraw'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmDefault && (
          <motion.div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center',
                               justifyContent: 'center', padding: 24, background: 'rgba(27,31,42,.6)',
                               backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowConfirmDefault(false)}>
            <motion.div style={{ background: D_T.surface, borderRadius: 24, width: '100%', maxWidth: 360,
                                  overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)' }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '24px 24px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: D_T.blush,
                              display: 'grid', placeItems: 'center', margin: '0 auto 16px',
                              fontSize: 24 }}>💀</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: D_T.ink, marginBottom: 8 }}>
                  {lang === 'th' ? 'ยืนยันหนี้เสีย?' : 'Confirm Default?'}
                </div>
                <div style={{ fontSize: 12, color: D_T.mute, marginBottom: 24, lineHeight: 1.5 }}>
                  {lang === 'th' ? 'รายการนี้จะถูกบันทึกว่าโดนบิด ยากที่จะยกเลิก' : 'This loan will be marked as defaulted. Hard to undo.'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowConfirmDefault(false)}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 999, background: D_T.surface2,
                             color: D_T.ink2, border: `1px solid ${D_T.line}`, fontSize: 12, fontWeight: 700,
                             cursor: 'pointer', fontFamily: font }}>
                    {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button onClick={() => { setShowConfirmDefault(false); handleUpdateStatus('โดนบิด'); }}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 999, background: D_T.blushDeep,
                             color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
                             cursor: 'pointer', fontFamily: font }}>
                    {lang === 'th' ? 'ยืนยัน' : 'Confirm default'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showProfitModal && data && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 16, background: 'rgba(27,31,42,.5)',
                      backdropFilter: 'blur(4px)' }}
          onClick={() => setShowProfitModal(false)}>
          <div style={{ background: D_T.surface, borderRadius: 24, width: '100%', maxWidth: 380,
                        overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${D_T.line}`, background: D_T.surface2,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'รายละเอียดกำไร' : 'Profit Breakdown'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums',
                              fontFamily: mono, color: s.netProfit >= 0 ? D_T.mintDeep : D_T.blushDeep }}>
                  {formatCurrency(s.netProfit)}
                </div>
              </div>
              <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setShowProfitModal(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer' }}><X size={16} weight="bold" aria-hidden="true" /></button>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                [lang === 'th' ? 'ดอกที่ได้รับ' : 'Interest received', s.paidInterest, D_T.mint, D_T.mintDeep, '+'],
                [lang === 'th' ? 'หักโดนบิด' : 'Defaults', s.scamPrincipal, D_T.blush, D_T.blushDeep, '−'],
                [lang === 'th' ? 'หักเบิก' : 'Withdrawals', s.withdrawn, D_T.butter, D_T.butterDeep, '−'],
              ].map(([label, val, bg, fg, sign]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      padding: '8px 12px', borderRadius: 12, background: bg as string + '40' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: fg as string }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: fg as string, fontFamily: mono }}>{sign}{formatCurrency(val as number)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 12px',
                            borderTop: `1.5px solid ${D_T.ink}`, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {lang === 'th' ? 'กำไรสุทธิ' : 'Net Profit'}
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: mono,
                               color: s.netProfit >= 0 ? D_T.mintDeep : D_T.blushDeep }}>
                  {formatCurrency(s.netProfit)}
                </span>
              </div>
              <div style={{ padding: '12px', borderRadius: 12, background: D_T.lavender + '40',
                            border: `1px solid ${D_T.lavender}` }}>
                <div style={{ fontSize: 12, color: D_T.lavDeep, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {lang === 'th' ? 'ดอกรอรับ' : 'Unrealized Interest'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: D_T.ink2 }}>{lang === 'th' ? 'ดอกที่ยังไม่ถึงกำหนด' : 'Pending'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: mono, color: D_T.lavDeep }}>+{formatCurrency(s.unpaidInterest)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${D_T.lavender}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: D_T.lavDeep }}>{lang === 'th' ? 'รวมถ้าเก็บครบ' : 'Total if collected'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, color: D_T.lavDeep }}>
                    {formatCurrency(s.paidInterest + s.unpaidInterest - s.scamPrincipal - s.withdrawn)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '12px', borderRadius: 12, background: D_T.surface2, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: mono }}>{s.profitPct.toFixed(1)}%</div>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
                    {lang === 'th' ? 'yield ต่อทุน' : 'Yield on capital'}
                  </div>
                </div>
                <div style={{ padding: '12px', borderRadius: 12, background: D_T.surface2, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: mono }}>{formatCurrency(s.paidInterest)}</div>
                  <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
                    {lang === 'th' ? 'ดอกสะสม' : 'Total interest'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWeeklySheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(27,31,42,.5)',
                      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowWeeklySheet(false)}>
          <div style={{ background: D_T.surface, width: '100%', borderRadius: '16px 16px 0 0',
                        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 -8px 40px -12px rgba(27,31,42,.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line}`,
                          background: D_T.surface2, borderRadius: '16px 16px 0 0',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 12, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'นับรอบทุกวันจันทร์' : 'Resets every Monday'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                  {lang === 'th' ? 'กำไรรายสัปดาห์' : 'Weekly Profit'}
                </div>
              </div>
              <button aria-label={lang === 'th' ? 'ปิด' : 'Close'} onClick={() => setShowWeeklySheet(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer' }}><X size={16} weight="bold" aria-hidden="true" /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {(() => {
                const fi = (v: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(v));
                const fmtDay = (d: Date) => d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' });
                return weeklySummary.length === 0
                  ? <div style={{ padding: '40px 16px', textAlign: 'center', color: D_T.mute, fontSize: 12 }}>ยังไม่มีข้อมูล</div>
                  : weeklySummary.map(w => {
                      const monday = new Date(w.key + 'T00:00:00');
                      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                      const net = w.interest - w.scam - w.withdrawn;
                      return (
                        <div key={w.key} style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line2}`,
                                                  display: 'flex', alignItems: 'center', gap: 12,
                                                  background: w.isCurrentWeek ? D_T.mint + '18' : 'transparent' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: D_T.ink }}>
                                {fmtDay(monday)} – {fmtDay(sunday)}
                              </span>
                              {w.isCurrentWeek && (
                                <span style={{ fontSize: 12, fontWeight: 700, color: D_T.mintDeep,
                                               background: D_T.mint + '60', borderRadius: 6, padding: '0 4px',
                                               letterSpacing: '.05em', textTransform: 'uppercase' }}>
                                  {lang === 'th' ? 'สัปดาห์นี้' : 'now'}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, color: D_T.mintDeep, fontWeight: 700, fontFamily: mono }}>+฿{fi(w.interest)}</span>
                              {w.scam > 0 && <span style={{ fontSize: 12, color: D_T.blushDeep, fontFamily: mono }}>−฿{fi(w.scam)}</span>}
                              {w.withdrawn > 0 && <span style={{ fontSize: 12, color: D_T.butterDeep, fontFamily: mono }}>เบิก ฿{fi(w.withdrawn)}</span>}
                              <span style={{ fontSize: 12, color: D_T.mute }}>{w.count} ราย</span>
                            </div>
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            <DChip tone={net >= 0 ? 'mint' : 'blush'}>
                              {net >= 0 ? '+' : '−'}฿{fi(Math.abs(net))}
                            </DChip>
                          </div>
                        </div>
                      );
                    });
              })()}
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }} className="animate-slide-up">
          <div style={{ padding: '12px 16px', borderRadius: 12, background: toastMessage.type === 'success' ? D_T.mintDeep : D_T.blushDeep,
                        color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 8px 24px rgba(27,31,42,.3)', fontFamily: font }}>
            {toastMessage.type === 'success' ? '✓' : '⚠'} {toastMessage.text}
          </div>
        </div>
      )}
    </div>
  );
}
