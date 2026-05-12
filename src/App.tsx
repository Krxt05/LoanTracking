import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fetchAppData, AppData, LoanRecord, updateLoanStatus, createNewLoan, editExistingLoan } from './services/dataService';
import { formatCurrency, parseThaiDate } from './lib/utils';
import { ResponsiveContainer, Tooltip as RechartsTooltip, Legend, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush, getNotificationPermission, sendTestNotification } from './services/pushService';
import { t, Lang } from './lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';


export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
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
  const [hasPenalty, setHasPenalty] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState(200);
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'loans' | 'analytics' | 'you'>('dashboard');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [showPortfolioLine2, setShowPortfolioLine2] = useState(false);
  const [showPortfolioLine3, setShowPortfolioLine3] = useState(false);
  const [portfolioTimeframe, setPortfolioTimeframe] = useState<'1M' | '3M' | '6M' | 'all'>('3M');
  const [portfolioTooltipIdx, setPortfolioTooltipIdx] = useState<number | null>(null);
  const portfolioChartRef = React.useRef<HTMLDivElement | null>(null);
  const portfolioScrollPos = React.useRef(-1); // -1 = scroll to rightmost end
  // Callback ref: restores saved scroll position (or scrolls to end) on every mount/remount
  const portfolioChartCallbackRef = React.useCallback((el: HTMLDivElement | null) => {
    portfolioChartRef.current = el;
    if (el) el.scrollLeft = portfolioScrollPos.current < 0 ? el.scrollWidth : portfolioScrollPos.current;
  }, []);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const pullStartY = React.useRef(0);
  const isPullingDown = React.useRef(false);

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
  const [isEditingLoan, setIsEditingLoan] = useState(false);
  const [editLoanForm, setEditLoanForm] = useState({
    principal: '500',
    borrowDate: new Date(),
    dueDate: new Date(),
    daysBorrowed: 7,
    interestRate: 35
  });

  // Reset states when selected loan changes
  useEffect(() => {
    setIsEditingLoan(false);
    setActionDate(new Date());
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
        interestRate: selectedLoan.interestRate || 20
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

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

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

  const portfolioGrowthData = useMemo(() => {
    if (!data) return [];
    const INITIAL = 20000;

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
      runGross += ev.earned;
      runInterest += ev.earned;
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
  }, [data, today]);

  const filteredPortfolioData = useMemo(() => {
    const days = portfolioTimeframe === '1M' ? 30 : portfolioTimeframe === '3M' ? 90 : portfolioTimeframe === '6M' ? 180 : Infinity;
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
      const newData = await fetchAppData();
      if (newData) { setData(newData); setLastSynced(new Date()); }
    } catch (e) {
      console.error(e);
      showToast('ไม่สามารถเชื่อมต่อดึงข้อมูลล่าสุดได้', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

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

      if (action === 'ชำระแล้ว') {
        targetLoan.isPaid = true;
        targetLoan.status = "ชำระแล้ว";
      } else if (action === 'โดนบิด') {
        targetLoan.isScam = true;
        targetLoan.status = "โดนบิด";
      } else if (action === 'ต่อดอก') {
        targetLoan.isRenewed = true;
        targetLoan.status = "ต่อดอก";

        // สร้างรายการจำลองขึ้นมาใหม่
        const newLoan = { ...targetLoan };
        newLoan.id = 'R' + Date.now().toString().slice(-6);
        newLoan.isRenewed = false;
        newLoan.isPaid = false;
        newLoan.isScam = false;
        newLoan.isOverdue = false;
        newLoan.isWithdrawn = false;
        newLoan.status = "ยังไม่ชำระ";

        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        newLoan.borrowDate = `${dd}/${mm}/${yyyy}`;

        const newDueDateObj = new Date(today.getTime() + ((targetLoan.daysBorrowed || 7) * 24 * 60 * 60 * 1000));
        const dueDd = String(newDueDateObj.getDate()).padStart(2, '0');
        const dueMm = String(newDueDateObj.getMonth() + 1).padStart(2, '0');
        const dueYyyy = newDueDateObj.getFullYear();
        newLoan.dueDate = `${dueDd}/${dueMm}/${dueYyyy}`;

        updatedLoans.push(newLoan);
      }

      updatedLoans[loanIndex] = targetLoan;
      setData({ ...data, loans: updatedLoans });
    }

    const success = await updateLoanStatus(currentLoan.id, action, formattedActionDate, hasPenalty ? penaltyAmount : 0);

    if (!success) {
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
        interestRate: editLoanForm.interestRate
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
            expectedInterest: (parseFloat(editLoanForm.principal) * editLoanForm.interestRate) / 100,
            totalExpected: parseFloat(editLoanForm.principal) + ((parseFloat(editLoanForm.principal) * editLoanForm.interestRate) / 100)
          };
          setData({ ...data, loans: updatedLoans });
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

  const handleTestNotif = async (type: 'morning' | 'afternoon') => {
    setIsSendingTestNotif(true);
    const dueCount = dueTodayLoans.length;
    const overdueCount = overdueLoans.length;
    if (type === 'morning') {
      await sendTestNotification('📊 สรุปยอดวันนี้', `ครบกำหนด ${dueCount} รายการ | ค้างชำระ ${overdueCount} รายการ`);
    } else {
      await sendTestNotification('🔔 แจ้งเตือนทวง', `มี ${dueCount} รายการที่ยังไม่ชำระวันนี้`);
    }
    setIsSendingTestNotif(false);
  };

  useEffect(() => {
    fetchAppData()
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
      <span style={{ padding: '3px 9px', borderRadius: 999, background: bg, color: fg,
                     fontSize: 10.5, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase',
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: D_T.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontFamily: '"Hanken Grotesk", system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: D_T.ink, color: D_T.butter,
                        display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800,
                        margin: '0 auto 20px' }}>P</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: D_T.ink, letterSpacing: '-.02em', marginBottom: 8 }}>
            Pocket Bank
          </div>
          <div style={{ fontSize: 12, color: D_T.mute, marginBottom: 24 }}>
            {lang === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading your data...'}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {[0, 120, 240].map(d => (
              <div key={d} style={{ width: 8, height: 8, borderRadius: 99, background: D_T.mintDeep,
                                    animation: 'bounce-dot 1.4s ease-in-out infinite', animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: D_T.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: 24, fontFamily: '"Hanken Grotesk", system-ui, sans-serif' }}>
        <div style={{ background: D_T.surface, padding: 32, borderRadius: 20, border: `1px solid ${D_T.line}`,
                      textAlign: 'center', maxWidth: 360, width: '100%' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: D_T.ink, marginBottom: 8 }}>ไม่สามารถเชื่อมต่อได้</div>
          <div style={{ fontSize: 13, color: D_T.mute, marginBottom: 24 }}>Failed to sync. Check your connection.</div>
          <button onClick={() => window.location.reload()}
            style={{ width: '100%', padding: '12px 0', background: D_T.ink, color: D_T.bg,
                     border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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

  const font = '"Hanken Grotesk", "IBM Plex Sans Thai", system-ui, sans-serif';
  const mono = '"DM Mono", ui-monospace, monospace';

  // --- Portfolio Growth Chart ---
  const PortfolioGrowthChart = ({ compact = false, hideControls = false }: { compact?: boolean; hideControls?: boolean }) => {
    const pts = filteredPortfolioData;
    const YELLOW = '#f5a623', RED = '#e04545';

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
                        marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            {/* Timeframe */}
            <div style={{ display: 'flex', gap: 3 }}>
              {(['1M', '3M', '6M', 'all'] as const).map(tf => (
                <button key={tf} onClick={() => { setPortfolioTimeframe(tf); setPortfolioTooltipIdx(null); }}
                  style={{ padding: '4px 9px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: font,
                           fontSize: 10.5, fontWeight: 700,
                           background: portfolioTimeframe === tf ? D_T.ink : D_T.surface2,
                           color: portfolioTimeframe === tf ? D_T.bg : D_T.mute }}>
                  {tf === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') : tf}
                </button>
              ))}
            </div>
            {/* Line toggles */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setShowPortfolioLine2(v => !v)}
                style={{ padding: '3px 9px', borderRadius: 999, cursor: 'pointer', fontFamily: font,
                         fontSize: 10, fontWeight: 700,
                         background: showPortfolioLine2 ? D_T.butter : D_T.surface2,
                         color: showPortfolioLine2 ? D_T.butterDeep : D_T.mute,
                         border: `1px solid ${showPortfolioLine2 ? D_T.butterDeep : D_T.line}` }}>
                {lang === 'th' ? 'กรอส' : 'Gross'}
              </button>
              <button onClick={() => setShowPortfolioLine3(v => !v)}
                style={{ padding: '3px 9px', borderRadius: 999, cursor: 'pointer', fontFamily: font,
                         fontSize: 10, fontWeight: 700,
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

            {/* Line 1: portfolio net (solid mint) */}
            <path d={makePath('portfolio')} fill="none" stroke={D_T.mintDeep} strokeWidth={2.5} strokeLinejoin="round" />
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
              width: 140, padding: '8px 10px', borderRadius: 10,
              background: D_T.ink, color: D_T.bg, fontSize: 11, fontFamily: font,
              boxShadow: '0 4px 16px rgba(27,31,42,.35)', pointerEvents: 'none', zIndex: 20,
            }}>
              <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
                {ttPt.isForecast ? (lang === 'th' ? '⟳ คาดการณ์' : '⟳ Forecast') : ttPt.date}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: mono, marginBottom: 4 }}>
                {formatCurrency(ttVal)}
              </div>
              {!ttPt.isForecast && (ttPt.earned > 0 || ttPt.scam > 0 || ttPt.withdrawn > 0) && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {ttPt.earned > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ opacity: 0.7 }}>{lang === 'th' ? '+ ดอก/ปรับ' : '+ interest'}</span>
                      <span style={{ color: '#7ef0a8', fontFamily: mono }}>+{formatCurrency(ttPt.earned)}</span>
                    </div>
                  )}
                  {ttPt.hasW && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: YELLOW }}>{lang === 'th' ? `เบิก (${ttPt.wNames.join(',')})` : `W/D (${ttPt.wNames.join(',')})`}</span>
                      <span style={{ color: YELLOW, fontFamily: mono }}>−{formatCurrency(ttPt.withdrawn)}</span>
                    </div>
                  )}
                  {ttPt.hasS && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: RED }}>{lang === 'th' ? `บิด (${ttPt.sNames.join(',')})` : `Default (${ttPt.sNames.join(',')})`}</span>
                      <span style={{ color: RED, fontFamily: mono }}>−{formatCurrency(ttPt.scam)}</span>
                    </div>
                  )}
                </div>
              )}
              {ttPt.isForecast && (ttPt as any).names?.length > 0 && (
                <div style={{ fontSize: 9.5, opacity: 0.65, marginTop: 2 }}>
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
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
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
              <span style={{ fontSize: 9.5, color: D_T.mute, fontWeight: 600 }}>{label}</span>
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

  return (
    <div style={{ minHeight: '100vh', background: D_T.bg, color: D_T.ink, fontFamily: font }}>

      {/* ── DESKTOP LAYOUT ─────────────────────────────── */}
      {isDesktop && <div style={{ minHeight: '100vh', display: 'flex' }}>

        {/* Sidebar */}
        <aside style={{ width: 224, minHeight: '100vh', padding: '24px 16px', display: 'flex',
                        flexDirection: 'column', gap: 4, background: D_T.surface2,
                        borderRight: `1px solid ${D_T.line}`, position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: '100vh', overflowY: 'auto' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px',
                        borderBottom: `1px solid ${D_T.line}`, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: D_T.ink, color: D_T.butter,
                          display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800 }}>P</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.02em' }}>
                {lang === 'th' ? 'พ็อกเก็ต แบงก์' : 'Pocket Bank'}
              </div>
              <div style={{ fontSize: 10, color: D_T.mute }}>
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
              onClick={() => setActiveMobileTab(tab as any)}
              style={{ padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                       background: activeMobileTab === tab ? D_T.surface : 'transparent',
                       color: activeMobileTab === tab ? D_T.ink : D_T.ink2,
                       fontSize: 13, fontWeight: activeMobileTab === tab ? 700 : 500,
                       display: 'flex', alignItems: 'center', gap: 10,
                       boxShadow: activeMobileTab === tab ? '0 1px 0 rgba(27,31,42,.04)' : 'none' }}>
              <span style={{ width: 16, color: activeMobileTab === tab ? D_T.mintDeep : D_T.mute2 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge !== null && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999,
                               background: D_T.bg, color: D_T.mute, fontWeight: 700 }}>{badge}</span>
              )}
            </div>
          ))}

          <div style={{ flex: 1 }} />

          {/* Sync status */}
          <div style={{ padding: 14, borderRadius: 14, background: D_T.surface, border: `1px solid ${D_T.line}`, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99,
                             background: isSyncing ? D_T.butterDeep : D_T.mintDeep, display: 'block' }} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{isSyncing ? (lang === 'th' ? 'กำลังซิงค์...' : 'Syncing...') : (lang === 'th' ? 'ซิงค์แล้ว' : 'Synced')}</span>
            </div>
            <div style={{ fontSize: 11, color: D_T.mute, lineHeight: 1.5 }}>
              {lang === 'th' ? 'ดึงจาก Google Sheets' : 'Pulled from your Sheets ledger.'}
            </div>
          </div>

          {/* Lang + refresh */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={toggleLang}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, fontSize: 11, fontWeight: 700,
                       color: D_T.ink2, cursor: 'pointer', fontFamily: font }}>
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <button onClick={() => loadData()}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, fontSize: 11, fontWeight: 700,
                       color: D_T.ink2, cursor: 'pointer', fontFamily: font }}>
              ↺
            </button>
            <button onClick={() => setShowNotifModal(true)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, fontSize: 14, cursor: 'pointer' }}>
              {isSubscribed ? '🔔' : '🔕'}
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Top bar */}
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                           padding: '20px 28px', borderBottom: `1px solid ${D_T.line}`, background: D_T.bg }}>
            <div>
              <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                            textTransform: 'uppercase', marginBottom: 4 }}>{todayLabel}</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>
                {lang === 'th' ? 'สวัสดี,' : 'Hey,'}{' '}
                <span style={{ color: D_T.mute }}>{greetSub}</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowWithdrawModal(true)}
                style={{ padding: '9px 16px', borderRadius: 999, background: D_T.surface,
                         color: D_T.ink, border: `1px solid ${D_T.line}`,
                         fontFamily: font, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'th' ? 'ถอนเงิน' : 'Withdraw'}
              </button>
              <button onClick={() => setShowNewLoanModal(true)}
                style={{ padding: '9px 18px', borderRadius: 999, background: D_T.ink,
                         color: D_T.bg, border: 'none',
                         fontFamily: font, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
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
              [lang === 'th' ? 'เงินสดว่าง' : 'Available cash', formatCurrency(s.available), null, null],
            ] as [string, string, string | null, boolean | null][]).map(([label, value, arrow, pos], i) => (
              <div key={label}
                onClick={i === 1 ? () => setShowProfitModal(true) : undefined}
                style={{ padding: '20px 24px', borderRight: i < 3 ? `1px solid ${D_T.line}` : 'none',
                         display: 'flex', flexDirection: 'column', gap: 10,
                         cursor: i === 1 ? 'pointer' : 'default' }}>
                <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: D_T.ink,
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
            <section style={{ padding: '22px 28px', overflowY: 'auto' }}>

              {activeMobileTab === 'analytics' ? (
                /* ── ANALYTICS TAB ── */
                <>
                  {/* Portfolio growth chart */}
                  <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                                borderRadius: 18, padding: '20px 22px 16px', marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                                  letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                      {lang === 'th' ? 'การเติบโตของพอร์ต' : 'Portfolio Growth'}
                    </div>
                    <PortfolioGrowthChart />
                  </div>

                  {/* Interest received chart */}
                  <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                                borderRadius: 18, padding: '20px 22px 16px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                                      letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          {lang === 'th' ? 'ดอกเบี้ยที่ได้รับ · 30 วันล่าสุด' : 'Interest received · last 30 days'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em',
                                         fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                            {formatCurrency(s.paidInterest)}
                          </span>
                          <DChip tone="mint">↗ {s.profitPct.toFixed(1)}%</DChip>
                        </div>
                      </div>
                      <button onClick={() => setShowExpandedTrend(true)}
                        style={{ padding: '5px 12px', borderRadius: 999, background: D_T.ink, color: D_T.bg,
                                 fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: font }}>
                        {lang === 'th' ? 'ขยาย' : 'Expand'}
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <DAreaChart sparkData={trendData30} w={640} h={160} showYAxis />
                    </div>
                    {trendData30.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6,
                                    fontFamily: mono, fontSize: 10, color: D_T.mute2, paddingLeft: 56 }}>
                        {trendData30.filter((_, i) => i % Math.ceil(trendData30.length / 6) === 0).map(m => (
                          <span key={m.date}>{m.date}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Monthly summary with breakdown */}
                  {monthlySummary.length > 0 && (
                    <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                                  borderRadius: 18, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 22px', borderBottom: `1px solid ${D_T.line}`,
                                    fontSize: 11, fontWeight: 700, color: D_T.mute,
                                    letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {lang === 'th' ? 'สรุปรายเดือน' : 'Monthly Summary'}
                      </div>
                      {monthlySummary.map(m => {
                        const d = new Date(m.year, m.month, 1);
                        const label = d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' });
                        const net = m.interest - m.scam - m.withdrawn;
                        return (
                          <div key={m.key} style={{ padding: '14px 22px', borderBottom: `1px solid ${D_T.line2}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: D_T.ink }}>{label}</div>
                                <div style={{ fontSize: 11, color: D_T.mute, marginTop: 2 }}>
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
                                <div key={lbl} style={{ padding: '8px 10px', borderRadius: 10, background: bg + '40' }}>
                                  <div style={{ fontSize: 9.5, fontWeight: 700, color: fg, letterSpacing: '.04em',
                                                textTransform: 'uppercase', marginBottom: 4 }}>{lbl}</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: fg,
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
                                  borderRadius: 18, padding: '20px 22px 16px', marginBottom: 22 }}>
                      <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                                    letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                        {lang === 'th' ? 'การเติบโตของพอร์ต' : 'Portfolio Growth'}
                      </div>
                      <PortfolioGrowthChart />
                    </div>
                  )}

                  {/* Table card */}
                  <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 18, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {([
                          ['all', lang === 'th' ? 'ทั้งหมด' : 'All', tabCounts.all],
                          ['renewals', lang === 'th' ? 'ต่อสัญญา' : 'Renewed', tabCounts.renewals],
                          ['paid', lang === 'th' ? 'จ่ายแล้ว' : 'Paid', tabCounts.paid],
                          ['defaulted', lang === 'th' ? 'หนี้เสีย' : 'Defaulted', tabCounts.defaulted],
                          ['withdrawn', lang === 'th' ? 'เบิก' : 'Withdrawn', tabCounts.withdrawn],
                        ] as [string, string, number][]).map(([tab, label, count]) => (
                          <span key={tab} onClick={() => { setActiveTab(tab as any); setSearchQuery(''); }}
                            style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                                     background: activeTab === tab ? D_T.ink : D_T.surface2,
                                     color: activeTab === tab ? D_T.bg : D_T.ink2,
                                     fontSize: 11.5, fontWeight: 700,
                                     display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {label}
                            {count > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                          placeholder={lang === 'th' ? 'ค้นหา...' : 'Search...'}
                          style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${D_T.line}`,
                                   background: D_T.surface2, fontSize: 11, color: D_T.ink,
                                   outline: 'none', fontFamily: font, width: 140 }} />
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                          style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${D_T.line}`,
                                   background: D_T.surface2, fontSize: 11, color: D_T.ink2,
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
                                                 fontSize: 10, color: D_T.mute2, fontWeight: 700,
                                                 letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody ref={tableRef}>
                        {filteredLoans.map(l => (
                          <tr key={l.id} onClick={() => setSelectedLoan(l)}
                            style={{ borderBottom: `1px solid ${D_T.line2}`, cursor: 'pointer',
                                     background: selectedLoan?.id === l.id ? D_T.surface2 : 'transparent',
                                     transition: 'background .12s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = D_T.surface2)}
                            onMouseLeave={e => (e.currentTarget.style.background = selectedLoan?.id === l.id ? D_T.surface2 : 'transparent')}>
                            <td style={{ padding: '13px 8px', fontFamily: mono, fontSize: 11, color: D_T.mute2 }}>{l.id}</td>
                            <td style={{ padding: '13px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 9, background: D_T.surface2,
                                              border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                                              fontSize: 10, color: D_T.ink, fontWeight: 700, flexShrink: 0 }}>
                                  {l.name.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: 13, color: D_T.ink, fontWeight: 600 }}>{l.name}</span>
                                {l.isOverdue && <DChip tone="blush">{l.daysLate}d</DChip>}
                              </div>
                            </td>
                            <td style={{ padding: '13px 8px', fontFamily: mono, fontSize: 12, color: D_T.ink,
                                         textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                              {formatCurrency(l.principal)}
                            </td>
                            <td style={{ padding: '13px 8px', fontFamily: mono, fontSize: 12,
                                         color: D_T.mintDeep, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              +{formatCurrency(l.expectedInterest)}
                            </td>
                            <td style={{ padding: '13px 8px', fontFamily: mono, fontSize: 12, color: D_T.ink2, textAlign: 'right' }}>
                              {l.interestRate}%
                            </td>
                            <td style={{ padding: '13px 8px', fontSize: 12, color: l.isOverdue ? D_T.blushDeep : D_T.ink2, textAlign: 'right' }}>
                              {l.dueDate}
                            </td>
                            <td style={{ padding: '13px 8px', textAlign: 'right' }}>
                              <DChip tone={getLoanTone(l)}>{getLoanStatusText(l)}</DChip>
                            </td>
                          </tr>
                        ))}
                        {filteredLoans.length === 0 && (
                          <tr><td colSpan={7} style={{ padding: '48px 0', textAlign: 'center', color: D_T.mute, fontSize: 13 }}>
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
            <aside style={{ borderLeft: `1px solid ${D_T.line}`, padding: '22px 24px',
                            background: D_T.bg, display: 'flex', flexDirection: 'column', gap: 18,
                            overflowY: 'auto' }}>

              {/* Today's collections */}
              <div>
                <div style={{ fontSize: 11, color: D_T.butterDeep, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {lang === 'th' ? 'วันนี้' : 'Today'} · {dueTodayLoans.length}
                </div>
                {dueTodayLoans.length === 0 ? (
                  <div style={{ padding: 16, borderRadius: 14, background: D_T.surface2,
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
                          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{l.name}</span>
                          <DChip tone="ghost">{l.id}</DChip>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.025em',
                                      fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                          {formatCurrency(l.totalExpected)}
                        </div>
                        <div style={{ fontSize: 11, color: D_T.ink2, marginTop: 2 }}>
                          {formatCurrency(l.principal)} + {formatCurrency(l.expectedInterest)} {lang === 'th' ? 'ดอก' : 'interest'}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                          <button onClick={() => setSelectedLoan(l)}
                            style={{ flex: 1, padding: '8px 0', background: D_T.ink, color: D_T.bg,
                                     border: 'none', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                                     cursor: 'pointer', fontFamily: font }}>
                            {lang === 'th' ? 'รับเงินแล้ว' : 'Got paid'}
                          </button>
                          <button onClick={() => setSelectedLoan(l)}
                            style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,.6)',
                                     color: D_T.ink, border: 'none', borderRadius: 999,
                                     fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                            {lang === 'th' ? 'ต่อสัญญา' : 'Renew'}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: D_T.blushDeep, fontWeight: 700,
                                   letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'ค้างชำระ' : 'Overdue'} · {overdueLoans.length}
                    </span>
                    <span style={{ fontSize: 11, color: D_T.blushDeep, fontWeight: 700, fontFamily: mono }}>
                      −{formatCurrency(overdueLoans.reduce((a, l) => a + l.totalExpected, 0))}
                    </span>
                  </div>
                  <div ref={overdueListRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {overdueLoans.map(l => (
                      <div key={l.id} onClick={() => setSelectedLoan(l)}
                        style={{ padding: 14, borderRadius: 14, background: D_T.blush, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</span>
                          <span style={{ fontSize: 11, color: D_T.blushDeep, fontWeight: 700 }}>
                            {lang === 'th' ? `ช้า ${l.daysLate} วัน` : `${l.daysLate}d late`}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: D_T.ink2 }}>
                          {formatCurrency(l.principal)} + {formatCurrency(l.expectedInterest)} · {l.dueDate}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allocation bars */}
              <div>
                <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {lang === 'th' ? 'เงินอยู่ที่ไหน' : 'Where the money is'}
                </div>
                {(() => {
                  const total = Math.max(s.totalLimit, 1);
                  const bars: [string, number, string][] = [
                    [lang === 'th' ? 'กำลังทำงาน' : 'Out earning', s.totalBorrowed - s.scamPrincipal, D_T.mintDeep],
                    [lang === 'th' ? 'พร้อมปล่อย' : 'Free to lend', s.available, D_T.butterDeep],
                    [lang === 'th' ? 'หนี้เสีย' : 'Stuck (default)', s.scamPrincipal, D_T.blushDeep],
                  ];
                  return bars.map(([label, val, color]) => (
                    <div key={label} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                        <span style={{ color: D_T.ink2, fontWeight: 600 }}>{label}</span>
                        <span style={{ color: D_T.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                          {formatCurrency(val)}
                        </span>
                      </div>
                      <div style={{ height: 6, background: D_T.surface2, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: Math.min(100, (val / total) * 100) + '%', height: '100%',
                                      background: color, borderRadius: 99 }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div style={{ marginTop: 'auto', fontSize: 11, color: D_T.mute2, fontStyle: 'italic', lineHeight: 1.5 }}>
                {lang === 'th' ? '"การปล่อยกู้คือความอดทนที่มีตัวเลขกำกับ"' : '"Lending is patience with a number on it."'}
              </div>
            </aside>
          </div>
        </div>
      </div>}

      {/* ── MOBILE LAYOUT ──────────────────────────────── */}
      {!isDesktop && <div
        style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: 80 }}
        onTouchStart={(e) => {
          if (window.scrollY === 0) {
            pullStartY.current = e.touches[0].clientY;
            isPullingDown.current = true;
          }
        }}
        onTouchMove={(e) => {
          if (!isPullingDown.current || isPullRefreshing) return;
          const delta = e.touches[0].clientY - pullStartY.current;
          if (delta > 0 && window.scrollY === 0) {
            e.preventDefault();
            setPullDistance(Math.min(80, delta * 0.45));
          } else {
            isPullingDown.current = false;
            setPullDistance(0);
          }
        }}
        onTouchEnd={() => {
          isPullingDown.current = false;
          if (pullDistance >= 64 && !isPullRefreshing) {
            setIsPullRefreshing(true);
            setPullDistance(64);
            loadData(false).finally(() => {
              setIsPullRefreshing(false);
              setPullDistance(0);
            });
          } else {
            setPullDistance(0);
          }
        }}
      >

        {/* Pull-to-refresh indicator */}
        <div style={{
          height: pullDistance,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', transition: isPullingDown.current ? 'none' : 'height .35s cubic-bezier(.4,0,.2,1)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: `2.5px solid ${D_T.line}`,
            borderTopColor: pullDistance >= 64 ? D_T.mintDeep : D_T.mute2,
            animation: isPullRefreshing ? 'ptr-spin .7s linear infinite' : 'none',
            transform: !isPullRefreshing ? `rotate(${(pullDistance / 64) * 270}deg)` : undefined,
            transition: isPullingDown.current ? 'none' : 'transform .2s',
            display: pullDistance > 4 ? 'block' : 'none',
          }} />
          <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* Mobile header */}
        <div style={{ padding: '10px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: D_T.bg, borderBottom: `1px solid ${D_T.line}`, position: 'sticky', top: 0, zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: D_T.ink, color: D_T.butter,
                          display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800 }}>P</div>
            <div>
              <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Pocket Bank
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.02em' }}>
                {lang === 'th' ? 'สวัสดี' : 'Hey'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={toggleLang}
              style={{ width: 32, height: 32, borderRadius: 10, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, fontSize: 10, fontWeight: 700,
                       color: D_T.ink2, cursor: 'pointer', fontFamily: font }}>
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <button onClick={() => setShowNotifModal(true)}
              style={{ width: 32, height: 32, borderRadius: 10, background: D_T.surface,
                       border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                       fontSize: 15, cursor: 'pointer', position: 'relative' }}>
              {isSubscribed ? '🔔' : '🔕'}
              {isSubscribed && overdueLoans.length > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7,
                               borderRadius: 99, background: D_T.blushDeep }} />
              )}
            </button>
          </div>
        </div>

        {/* Dashboard tab */}
        {activeMobileTab === 'dashboard' && (
          <div style={{ padding: '10px 18px 0' }}>
            {/* Hero card */}
            <div style={{ padding: 20, borderRadius: 22, background: D_T.surface,
                          border: `1px solid ${D_T.line}`, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {lang === 'th' ? 'พอร์ตรวม' : 'Total portfolio'}
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.025em', marginTop: 4,
                            lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                {formatCurrency(s.totalLimit)}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <DChip tone={s.netProfit >= 0 ? 'mint' : 'blush'}>
                  {s.netProfit >= 0 ? '↗' : '↘'} {formatCurrency(Math.abs(s.netProfit))}
                </DChip>
                <span style={{ fontSize: 11, color: D_T.mute }}>{s.profitPct.toFixed(1)}% lifetime</span>
              </div>
              <div style={{ marginTop: 14, marginLeft: -4, marginRight: -4, overflowX: 'hidden' }}>
                <MiniPortfolioChart />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                <div style={{ padding: 12, borderRadius: 12, background: D_T.surface2 }}>
                  <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {lang === 'th' ? 'ว่าง' : 'Free'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2,
                                fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                    {formatCurrency(s.available)}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 12, background: D_T.surface2 }}>
                  <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    NPL
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: D_T.blushDeep,
                                fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                    {nplRatio.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Collect today */}
            {dueTodayLoans.length > 0 && (
              <div style={{ padding: 16, borderRadius: 18, background: D_T.butter, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: D_T.butterDeep, fontWeight: 800,
                                  letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'เก็บวันนี้' : 'Collect today'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.025em', marginTop: 2,
                                  fontFamily: mono }}>
                      {formatCurrency(dueTodayLoans.reduce((a, l) => a + l.totalExpected, 0))}
                    </div>
                  </div>
                  <DChip tone="ghost">{dueTodayLoans.length} {lang === 'th' ? 'ราย' : 'due'}</DChip>
                </div>
                {dueTodayLoans.slice(0, 2).map(l => (
                  <div key={l.id} onClick={() => setSelectedLoan(l)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                             background: 'rgba(255,255,255,.6)', borderRadius: 12, marginTop: 8, cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: D_T.ink,
                                  color: D_T.butter, display: 'grid', placeItems: 'center',
                                  fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {l.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</div>
                      <div style={{ fontSize: 10.5, color: D_T.ink2 }}>
                        {formatCurrency(l.principal)} + {formatCurrency(l.expectedInterest)} · {l.id}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setSelectedLoan(l); }}
                      style={{ padding: '7px 12px', borderRadius: 999, background: D_T.ink,
                               color: D_T.bg, border: 'none', fontSize: 11, fontWeight: 700,
                               fontFamily: font, cursor: 'pointer' }}>
                      {lang === 'th' ? 'รับแล้ว' : 'Paid'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Overdue */}
            {overdueLoans.length > 0 && (
              <div style={{ padding: 16, borderRadius: 18, background: D_T.blush + '60',
                            border: `1px solid ${D_T.blush}`, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: D_T.blushDeep, fontWeight: 800,
                                  letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'เกินกำหนด' : 'Overdue'}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.025em', marginTop: 2,
                                  fontFamily: mono, color: D_T.blushDeep }}>
                      {formatCurrency(overdueLoans.reduce((a, l) => a + l.totalExpected, 0))}
                    </div>
                  </div>
                  <DChip tone="blush">{overdueLoans.length} {lang === 'th' ? 'ราย' : 'overdue'}</DChip>
                </div>
                <div ref={overdueListRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {overdueLoans.slice(0, 3).map(l => (
                    <div key={l.id} onClick={() => setSelectedLoan(l)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                               background: 'rgba(255,255,255,.55)', borderRadius: 12, cursor: 'pointer' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: D_T.blushDeep,
                                    color: '#fff', display: 'grid', placeItems: 'center',
                                    fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        {l.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: D_T.ink }}>{l.name}</div>
                        <div style={{ fontSize: 10.5, color: D_T.blushDeep, fontWeight: 600 }}>
                          {l.daysLate} {lang === 'th' ? 'วัน' : 'd'} · {formatCurrency(l.totalExpected)}
                        </div>
                      </div>
                      <DChip tone="blush">{l.daysLate}{lang === 'th' ? 'ว' : 'd'}</DChip>
                    </div>
                  ))}
                  {overdueLoans.length > 3 && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: D_T.blushDeep, fontWeight: 700, paddingTop: 2 }}>
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
          <div style={{ padding: '12px 18px 0' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder={lang === 'th' ? 'ค้นหา...' : 'Search...'}
                  style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 12,
                           border: `1px solid ${D_T.line}`, background: D_T.surface, fontSize: 13,
                           color: D_T.ink, outline: 'none', fontFamily: font, boxSizing: 'border-box' }} />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                             background: 'none', border: 'none', cursor: 'pointer', color: D_T.mute, fontSize: 14 }}>✕</button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }} className="no-scrollbar">
              {(['all', 'renewals', 'paid', 'defaulted', 'withdrawn'] as const).map(tab => (
                <span key={tab} onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
                  style={{ padding: '6px 14px', borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                           background: activeTab === tab ? D_T.ink : D_T.surface,
                           color: activeTab === tab ? D_T.bg : D_T.ink2,
                           fontSize: 11.5, fontWeight: 700, border: `1px solid ${D_T.line}`,
                           display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {tab === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') :
                   tab === 'renewals' ? (lang === 'th' ? 'ต่อสัญญา' : 'Renewed') :
                   tab === 'paid' ? (lang === 'th' ? 'จ่ายแล้ว' : 'Paid') :
                   tab === 'defaulted' ? (lang === 'th' ? 'หนี้เสีย' : 'Default') :
                   (lang === 'th' ? 'เบิก' : 'Payout')}
                  {tabCounts[tab] > 0 && <span style={{ fontSize: 10, opacity: .7 }}>{tabCounts[tab]}</span>}
                </span>
              ))}
            </div>
            <div ref={tableRef as any}>
              {filteredLoans.map(l => (
                <div key={l.id} onClick={() => setSelectedLoan(l)}
                  style={{ background: D_T.surface, borderRadius: 14, padding: '12px 14px', marginBottom: 8,
                           display: 'flex', alignItems: 'center', gap: 12,
                           border: `1px solid ${l.isOverdue ? D_T.blush : D_T.line2}`, cursor: 'pointer' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                                background: getLoanTone(l) === 'blush' ? D_T.blush : getLoanTone(l) === 'mint' ? D_T.mint : D_T.surface2,
                                border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                                fontSize: 12, fontWeight: 800 }}>
                    {l.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{l.name}</span>
                      <DChip tone={getLoanTone(l)}>{getLoanStatusText(l)}</DChip>
                    </div>
                    <div style={{ fontSize: 11, color: D_T.mute, marginTop: 2 }}>
                      {l.id} · {l.isOverdue ? (lang === 'th' ? `ช้า ${l.daysLate} วัน` : `${l.daysLate}d overdue`) : `${lang === 'th' ? 'กำหนด' : 'due'} ${l.dueDate}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                      {formatCurrency(l.totalExpected)}
                    </div>
                    <div style={{ fontSize: 10, color: D_T.mute, marginTop: 1 }}>{l.interestRate}%</div>
                  </div>
                </div>
              ))}
              {filteredLoans.length === 0 && (
                <div style={{ padding: '48px 0', textAlign: 'center', color: D_T.mute, fontSize: 13 }}>
                  {lang === 'th' ? 'ไม่พบรายการ' : 'No results found'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics tab */}
        {activeMobileTab === 'analytics' && (
          <div style={{ padding: '12px 18px 0' }}>

            {/* Portfolio growth chart */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                          borderRadius: 18, padding: '14px 16px 12px', marginBottom: 12 }}>
              <PortfolioGrowthChart compact />
            </div>

            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                          borderRadius: 18, padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                            letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                {lang === 'th' ? 'ดอกเบี้ยที่ได้รับ · 30 วัน' : 'Interest received · 30 days'}
              </div>
              <div style={{ overflowX: 'hidden' }}>
                <DAreaChart sparkData={trendData30} w={320} h={110} showYAxis />
              </div>
              <button onClick={() => setShowExpandedTrend(true)}
                style={{ marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 999,
                         background: D_T.ink, color: D_T.bg, border: 'none',
                         fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                {lang === 'th' ? 'ดูแบบละเอียด' : 'View full chart'}
              </button>
            </div>

            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {([
                [lang === 'th' ? 'พอร์ตรวม' : 'Portfolio', formatCurrency(s.totalLimit), 'ghost'],
                [lang === 'th' ? 'กำไรสุทธิ' : 'Net profit', formatCurrency(s.netProfit), s.netProfit >= 0 ? 'mint' : 'blush'],
                [lang === 'th' ? 'หนี้เสีย' : 'NPL', nplRatio.toFixed(1) + '%', nplRatio > 10 ? 'blush' : 'mint'],
                [lang === 'th' ? 'เงินสดว่าง' : 'Available', formatCurrency(s.available), 'butter'],
              ] as [string, string, string][]).map(([label, value, tone]) => (
                <div key={label} style={{ padding: '14px 16px', borderRadius: 14,
                                          background: D_T.surface, border: `1px solid ${D_T.line}` }}>
                  <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700,
                                letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '-.02em', fontFamily: mono }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Monthly summary */}
            {monthlySummary.length > 0 && (
              <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                            borderRadius: 18, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '12px 18px', borderBottom: `1px solid ${D_T.line}`,
                              fontSize: 11, fontWeight: 700, color: D_T.mute,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'สรุปรายเดือน' : 'Monthly Summary'}
                </div>
                {monthlySummary.slice(0, 6).map(m => {
                  const d = new Date(m.year, m.month, 1);
                  const label = d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: 'numeric' });
                  const net = m.interest - m.scam - m.withdrawn;
                  return (
                    <div key={m.key} style={{ padding: '12px 18px', borderBottom: `1px solid ${D_T.line2}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: D_T.ink }}>{label}</div>
                          <div style={{ fontSize: 11, color: D_T.mute, marginTop: 1 }}>
                            {m.count} {lang === 'th' ? 'รายการ' : 'records'}
                          </div>
                        </div>
                        <DChip tone={net >= 0 ? 'mint' : 'blush'}>{net >= 0 ? '+' : ''}{formatCurrency(net)}</DChip>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
                        {([
                          [lang === 'th' ? 'รายได้ดอก' : 'Income', m.interest, D_T.mintDeep, D_T.mint],
                          [lang === 'th' ? 'หนี้บิด' : 'Defaults', m.scam, D_T.blushDeep, D_T.blush],
                          [lang === 'th' ? 'เบิก' : 'Withdrawn', m.withdrawn, D_T.butterDeep, D_T.butter],
                          [lang === 'th' ? 'สุทธิ' : 'Net', net, net >= 0 ? D_T.mintDeep : D_T.blushDeep, net >= 0 ? D_T.mint : D_T.blush],
                        ] as [string, number, string, string][]).map(([lbl, val, fg, bg]) => (
                          <div key={lbl} style={{ padding: '6px 8px', borderRadius: 8, background: bg + '40' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: fg, letterSpacing: '.04em',
                                          textTransform: 'uppercase', marginBottom: 2 }}>{lbl}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: fg,
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
          </div>
        )}

        {/* You tab */}
        {activeMobileTab === 'you' && (
          <div style={{ padding: '16px 18px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Profile card */}
            <div style={{ background: D_T.ink, borderRadius: 20, padding: '20px 20px 18px',
                          display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: D_T.butter,
                            display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 800,
                            color: D_T.ink, flexShrink: 0 }}>P</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: D_T.bg, letterSpacing: '-.01em' }}>
                  {lang === 'th' ? 'พ็อกเก็ต แบงก์' : 'Pocket Bank'}
                </div>
                <div style={{ fontSize: 11, color: D_T.mute2, marginTop: 3 }}>
                  {lang === 'th' ? 'โต๊ะปล่อยกู้ส่วนตัว' : 'Personal lending desk'}
                </div>
              </div>
            </div>

            {/* Capital overview */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${D_T.line}`,
                            fontSize: 10, fontWeight: 700, color: D_T.mute,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {lang === 'th' ? 'ภาพรวมทุน' : 'Capital Overview'}
              </div>
              {([
                [lang === 'th' ? 'ทุนตั้งต้น' : 'Initial capital', formatCurrency(20000), D_T.ink, D_T.surface2],
                [lang === 'th' ? 'วงเงินปัจจุบัน' : 'Current limit', formatCurrency(s.totalLimit), D_T.ink, D_T.surface2],
                [lang === 'th' ? 'ออกอยู่' : 'Deployed', formatCurrency(s.totalBorrowed - s.scamPrincipal), D_T.ink2, D_T.surface2],
                [lang === 'th' ? 'เงินสดว่าง' : 'Available', formatCurrency(s.available), D_T.mintDeep, D_T.mint + '25'],
                [lang === 'th' ? 'กำไรสะสม' : 'Profit earned', formatCurrency(s.paidInterest), D_T.mintDeep, D_T.mint + '25'],
                [lang === 'th' ? 'NPL ratio' : 'NPL ratio', nplRatio.toFixed(1) + '%', nplRatio > 10 ? D_T.blushDeep : D_T.mintDeep, nplRatio > 10 ? D_T.blush + '25' : D_T.mint + '25'],
              ] as [string, string, string, string][]).map(([label, value, fg, bg]) => (
                <div key={label} style={{ padding: '12px 16px', borderBottom: `1px solid ${D_T.line2}`,
                                          background: bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: D_T.ink2, fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: fg,
                                  fontFamily: mono, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Settings */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${D_T.line}`,
                            fontSize: 10, fontWeight: 700, color: D_T.mute,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {lang === 'th' ? 'ตั้งค่า' : 'Settings'}
              </div>

              {/* Language */}
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${D_T.line2}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: D_T.ink }}>
                    {lang === 'th' ? 'ภาษา' : 'Language'}
                  </div>
                  <div style={{ fontSize: 11, color: D_T.mute, marginTop: 2 }}>
                    {lang === 'th' ? 'ไทย' : 'English'}
                  </div>
                </div>
                <button onClick={toggleLang}
                  style={{ padding: '6px 14px', borderRadius: 999, border: `1px solid ${D_T.line}`,
                           background: D_T.surface2, fontSize: 12, fontWeight: 700, color: D_T.ink,
                           cursor: 'pointer', fontFamily: font }}>
                  {lang === 'th' ? 'EN' : 'TH'}
                </button>
              </div>

              {/* Notifications */}
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${D_T.line2}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D_T.ink }}>
                      {lang === 'th' ? 'การแจ้งเตือน' : 'Notifications'}
                    </div>
                    <div style={{ fontSize: 11, color: isSubscribed ? D_T.mintDeep : notifPermission === 'denied' ? D_T.blushDeep : D_T.mute, marginTop: 2 }}>
                      {isSubscribed ? (lang === 'th' ? '🔔 เปิดอยู่' : '🔔 On') :
                       notifPermission === 'denied' ? (lang === 'th' ? '🚫 ถูกบล็อก' : '🚫 Blocked') :
                       (lang === 'th' ? '🔕 ปิดอยู่' : '🔕 Off')}
                    </div>
                  </div>
                  {!isSubscribed && notifPermission !== 'denied' && (
                    <button onClick={handleEnableNotif}
                      style={{ padding: '6px 14px', borderRadius: 999, background: D_T.ink,
                               color: D_T.bg, border: 'none', fontSize: 12, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'เปิด' : 'Enable'}
                    </button>
                  )}
                  {isSubscribed && (
                    <button onClick={handleDisableNotif}
                      style={{ padding: '6px 14px', borderRadius: 999, background: D_T.blush,
                               color: D_T.blushDeep, border: 'none', fontSize: 12, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'ปิด' : 'Disable'}
                    </button>
                  )}
                </div>
                {isSubscribed && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button onClick={() => handleTestNotif('morning')} disabled={isSendingTestNotif}
                      style={{ padding: '7px 0', borderRadius: 10, background: D_T.lavender,
                               color: D_T.lavDeep, border: 'none', fontSize: 11, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'ทดสอบ เช้า' : 'Test Morning'}
                    </button>
                    <button onClick={() => handleTestNotif('afternoon')} disabled={isSendingTestNotif}
                      style={{ padding: '7px 0', borderRadius: 10, background: D_T.lavender,
                               color: D_T.lavDeep, border: 'none', fontSize: 11, fontWeight: 700,
                               cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'ทดสอบ บ่าย' : 'Test Afternoon'}
                    </button>
                  </div>
                )}
              </div>

              {/* Dark mode placeholder */}
              <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: D_T.mute2 }}>
                    {lang === 'th' ? 'โหมดมืด' : 'Dark mode'}
                  </div>
                  <div style={{ fontSize: 11, color: D_T.mute2, marginTop: 2 }}>
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
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`, borderRadius: 18, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${D_T.line}`,
                            fontSize: 10, fontWeight: 700, color: D_T.mute,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {lang === 'th' ? 'ข้อมูล & ซิงค์' : 'Data & Sync'}
              </div>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${D_T.line2}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: D_T.ink }}>
                    {lang === 'th' ? 'ซิงค์ล่าสุด' : 'Last synced'}
                  </div>
                  <div style={{ fontSize: 11, color: D_T.mute, marginTop: 2 }}>
                    {lastSynced
                      ? lastSynced.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                      : (lang === 'th' ? 'ยังไม่ได้ซิงค์' : 'Not synced yet')}
                  </div>
                </div>
                <button onClick={() => loadData(false)} disabled={isSyncing}
                  style={{ padding: '6px 14px', borderRadius: 999, background: isSyncing ? D_T.surface2 : D_T.ink,
                           color: isSyncing ? D_T.mute : D_T.bg, border: 'none',
                           fontSize: 12, fontWeight: 700, cursor: isSyncing ? 'default' : 'pointer',
                           fontFamily: font, transition: 'all .15s' }}>
                  {isSyncing ? (lang === 'th' ? 'กำลังซิงค์...' : 'Syncing...') : (lang === 'th' ? 'รีเฟรช' : 'Refresh')}
                </button>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: D_T.mute2 }}>{lang === 'th' ? 'เวอร์ชัน' : 'Version'}</span>
                <span style={{ fontSize: 12, color: D_T.mute2, fontFamily: mono }}>1.0.0</span>
              </div>
            </div>

          </div>
        )}

        {/* Mobile bottom tab bar */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex',
                      justifyContent: 'space-around', alignItems: 'center',
                      padding: '10px 16px 20px', borderTop: `1px solid ${D_T.line}`,
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
                onClick={() => {
                  if (id === 'fab') setShowFabMenu(v => !v);
                  else setActiveMobileTab(id as any);
                }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <div style={{ width: isPrimary ? 44 : 26, height: isPrimary ? 44 : 26,
                               borderRadius: isPrimary ? 14 : 0,
                               background: isPrimary ? D_T.ink : 'transparent',
                               color: isPrimary ? D_T.butter : isActive ? D_T.mintDeep : D_T.mute2,
                               display: 'grid', placeItems: 'center',
                               fontSize: isPrimary ? 22 : 16, fontWeight: 800 }}>
                  {icon}
                  {id === 'loans' && overdueLoans.length > 0 && (
                    <span style={{ position: 'absolute', top: -2, right: -6, width: 14, height: 14,
                                   borderRadius: 99, background: D_T.blushDeep, color: '#fff',
                                   fontSize: 8, fontWeight: 800, display: 'grid', placeItems: 'center' }}>
                      {overdueLoans.length}
                    </span>
                  )}
                </div>
                {!isPrimary && (
                  <span style={{ fontSize: 9.5, color: isActive ? D_T.ink : D_T.mute2,
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
              <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${D_T.line}`,
                            background: D_T.surface2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <DChip tone="ghost">{selectedLoan.id}</DChip>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setIsEditingLoan(!isEditingLoan)}
                      style={{ width: 30, height: 30, borderRadius: 99, border: `1px solid ${D_T.line}`,
                               background: isEditingLoan ? D_T.lavender : D_T.surface,
                               color: isEditingLoan ? D_T.lavDeep : D_T.ink,
                               fontSize: 13, cursor: 'pointer' }}>✎</button>
                    <button onClick={() => setSelectedLoan(null)}
                      style={{ width: 30, height: 30, borderRadius: 99, border: 'none',
                               background: 'rgba(27,31,42,.06)', fontSize: 14, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16,
                                background: getLoanTone(selectedLoan) === 'blush' ? D_T.blush :
                                            getLoanTone(selectedLoan) === 'mint' ? D_T.mint :
                                            getLoanTone(selectedLoan) === 'lav' ? D_T.lavender : D_T.butter,
                                color: getLoanTone(selectedLoan) === 'blush' ? D_T.blushDeep :
                                       getLoanTone(selectedLoan) === 'mint' ? D_T.mintDeep :
                                       getLoanTone(selectedLoan) === 'lav' ? D_T.lavDeep : D_T.butterDeep,
                                display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 800, flexShrink: 0 }}>
                    {selectedLoan.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>{selectedLoan.name}</div>
                    <div style={{ fontSize: 12, color: D_T.mute, marginTop: 2 }}>
                      {selectedLoan.historicalRenewalCount > 0
                        ? `${lang === 'th' ? 'ต่อสัญญา' : 'Renewed'} ${selectedLoan.historicalRenewalCount} ${lang === 'th' ? 'ครั้ง' : 'time(s)'}`
                        : lang === 'th' ? 'ไม่มีประวัติการต่อสัญญา' : 'No renewals on record'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {isEditingLoan ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'แก้ไขรายการ' : 'Edit loan'}
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        {lang === 'th' ? 'เงินต้น' : 'Principal'}
                      </label>
                      <input type="number" value={editLoanForm.principal}
                        onChange={e => setEditLoanForm({ ...editLoanForm, principal: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${D_T.line}`,
                                 background: D_T.surface2, fontSize: 16, fontWeight: 700, color: D_T.ink,
                                 outline: 'none', fontFamily: mono, boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                        {[10, 50, 100, 500, 1000].map(amt => (
                          <button key={amt} type="button"
                            onClick={() => setEditLoanForm(f => ({ ...f, principal: String(Math.max(0, parseFloat(f.principal || '0') + amt)) }))}
                            style={{ padding: '5px 10px', borderRadius: 999, background: D_T.surface2,
                                     color: D_T.ink2, fontSize: 11, fontWeight: 700, border: `1px solid ${D_T.line}`, cursor: 'pointer' }}>
                            +{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        {lang === 'th' ? 'อัตราดอก (%)' : 'Interest rate (%)'}
                      </label>
                      <input type="number" value={editLoanForm.interestRate}
                        onChange={e => setEditLoanForm({ ...editLoanForm, interestRate: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${D_T.line}`,
                                 background: D_T.surface2, fontSize: 16, fontWeight: 700, color: D_T.ink,
                                 outline: 'none', fontFamily: mono, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                          {lang === 'th' ? 'วันที่กู้' : 'Issue date'}
                        </label>
                        <DatePicker selected={editLoanForm.borrowDate}
                          onChange={(date: Date | null) => {
                            if (!date) return;
                            const dDate = new Date(date.getTime() + editLoanForm.daysBorrowed * 86400000);
                            setEditLoanForm(f => ({ ...f, borrowDate: date, dueDate: dDate }));
                          }}
                          dateFormat="dd/MM/yyyy"
                          className="w-full" />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                          {lang === 'th' ? 'กำหนดชำระ' : 'Due date'}
                        </label>
                        <DatePicker selected={editLoanForm.dueDate}
                          onChange={handleEditDueDateChange}
                          dateFormat="dd/MM/yyyy"
                          className="w-full" />
                      </div>
                    </div>
                    <div style={{ padding: 16, borderRadius: 14, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12, color: D_T.mute }}>{lang === 'th' ? 'ยอดที่คาดว่าจะรับ' : 'Expected total'}</span>
                        <span style={{ fontSize: 20, fontWeight: 800, fontFamily: mono }}>
                          {formatCurrency(parseFloat(editLoanForm.principal || '0') + ((parseFloat(editLoanForm.principal || '0') * editLoanForm.interestRate) / 100))}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Amount */}
                    <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {lang === 'th' ? 'เขาเป็นหนี้คุณ' : 'They owe you'}
                    </div>
                    <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-.025em', marginTop: 4,
                                  lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                      {formatCurrency(selectedLoan.totalExpected)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                      <DChip tone={getLoanTone(selectedLoan)}>{getLoanStatusText(selectedLoan)}</DChip>
                      <span style={{ fontSize: 12, color: D_T.mute }}>
                        {lang === 'th' ? 'กำหนด' : 'due'} {selectedLoan.dueDate}
                        {selectedLoan.isOverdue ? ` · ${lang === 'th' ? 'ช้า' : ''} ${selectedLoan.daysLate} ${lang === 'th' ? 'วัน' : 'd late'}` : ''}
                      </span>
                    </div>

                    {/* Breakdown */}
                    <div style={{ marginTop: 22, padding: 18, borderRadius: 16, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                      {[
                        [lang === 'th' ? 'เงินต้น' : 'Principal', formatCurrency(selectedLoan.principal), D_T.ink],
                        [`${lang === 'th' ? 'ดอก' : 'Interest'} @ ${selectedLoan.interestRate}%`, '+' + formatCurrency(selectedLoan.expectedInterest), D_T.mintDeep],
                        [lang === 'th' ? 'ค่าปรับ' : 'Penalty', formatCurrency(selectedLoan.penalty), D_T.mute],
                      ].map(([k, v, c], i, arr) => (
                        <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between',
                                          padding: '10px 0',
                                          borderBottom: i < arr.length - 1 ? `1px dashed ${D_T.line}` : 'none' }}>
                          <span style={{ fontSize: 13, color: D_T.ink2, fontWeight: 600 }}>{k}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: c as string, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                    marginTop: 12, paddingTop: 12, borderTop: `1.5px solid ${D_T.ink}` }}>
                        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                          {lang === 'th' ? 'รวม' : 'Total'}
                        </span>
                        <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
                          {formatCurrency(selectedLoan.totalExpected)}
                        </span>
                      </div>
                    </div>

                    {/* Dates */}
                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                        <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                          {lang === 'th' ? 'วันที่กู้' : 'Borrowed'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: mono }}>{selectedLoan.borrowDate}</div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                        <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                          {lang === 'th' ? 'กำหนดคืน' : 'Due back'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, color: selectedLoan.isOverdue ? D_T.blushDeep : D_T.ink }}>
                          {selectedLoan.dueDate}
                        </div>
                      </div>
                    </div>

                    {/* Renewal history */}
                    {selectedLoan.historicalRenewalCount > 0 && (
                      <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: D_T.lavender + '40', border: `1px solid ${D_T.lavender}` }}>
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
                      <div style={{ marginTop: 18, padding: '10px 14px', borderRadius: 12,
                                    background: D_T.butter + '60', border: `1px solid ${D_T.line}` }}>
                        <div style={{ fontSize: 10, color: D_T.butterDeep, fontWeight: 700,
                                      letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                          {lang === 'th' ? 'หมายเหตุ' : 'Note'}
                        </div>
                        <div style={{ fontSize: 13, color: D_T.ink, lineHeight: 1.5 }}>{selectedLoan.note}</div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div style={{ marginTop: 22 }}>
                      <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
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
                        <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 14, position: 'relative' }}>
                          {i < 2 && <div style={{ position: 'absolute', left: 6, top: 18, bottom: -4, width: 1.5, background: D_T.line }} />}
                          <div style={{ width: 14, height: 14, borderRadius: 99, flexShrink: 0, marginTop: 4, position: 'relative', zIndex: 1,
                                        background: state === 'done' ? D_T.mintDeep : state === 'next' ? D_T.butter : D_T.surface,
                                        border: state === 'future' ? `1.5px dashed ${D_T.mute2}` : 'none' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: state === 'future' ? D_T.mute : D_T.ink }}>{title}</span>
                              <span style={{ fontSize: 11, color: D_T.mute, fontFamily: mono }}>{date}</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: D_T.mute, marginTop: 2 }}>{sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Penalty toggle */}
                {!isEditingLoan && !selectedLoan.isPaid && !selectedLoan.isScam && !selectedLoan.isRenewed && (
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: D_T.surface2, border: `1px solid ${D_T.line}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasPenalty ? 10 : 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: D_T.ink2, flex: 1 }}>
                        {lang === 'th' ? 'ค่าปรับ' : 'Penalty'}
                      </span>
                      <div style={{ display: 'flex', borderRadius: 99, overflow: 'hidden', border: `1px solid ${D_T.line}` }}>
                        <button onClick={() => setHasPenalty(false)}
                          style={{ padding: '5px 12px', background: !hasPenalty ? D_T.ink : 'transparent',
                                   color: !hasPenalty ? D_T.bg : D_T.ink2, fontSize: 11, fontWeight: 700,
                                   border: 'none', cursor: 'pointer', fontFamily: font }}>
                          {lang === 'th' ? 'ไม่มี' : 'None'}
                        </button>
                        <button onClick={() => { setPenaltyAmount(Math.max(1, selectedLoan.daysLate) * 200); setHasPenalty(true); }}
                          style={{ padding: '5px 12px', background: hasPenalty ? D_T.butter : 'transparent',
                                   color: hasPenalty ? D_T.butterDeep : D_T.ink2, fontSize: 11, fontWeight: 700,
                                   border: 'none', cursor: 'pointer', fontFamily: font }}>
                          {lang === 'th' ? 'มี' : 'Yes'}
                        </button>
                      </div>
                    </div>
                    {hasPenalty && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="number" value={penaltyAmount}
                          onChange={e => setPenaltyAmount(Math.max(0, parseInt(e.target.value) || 0))}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${D_T.butter}`,
                                   background: D_T.butter + '60', fontSize: 14, fontWeight: 700,
                                   color: D_T.butterDeep, outline: 'none', fontFamily: mono }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: D_T.butterDeep }}>฿</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action date */}
                {!isEditingLoan && !selectedLoan.isPaid && !selectedLoan.isScam && !selectedLoan.isRenewed && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: D_T.mute, whiteSpace: 'nowrap' }}>
                      {lang === 'th' ? 'วันที่ดำเนินการ' : 'Action date'}
                    </span>
                    <DatePicker selected={actionDate}
                      onChange={(date) => date && setActionDate(date)}
                      dateFormat="dd/MM/yyyy"
                      className="w-full" />
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: 8,
                            borderTop: `1px solid ${D_T.line}`, background: D_T.surface }}>
                {isEditingLoan ? (
                  <button onClick={handleSaveEdit} disabled={isSyncing}
                    style={{ width: '100%', padding: '13px 0', borderRadius: 999, background: D_T.ink,
                             color: D_T.bg, border: 'none', fontSize: 14, fontWeight: 800,
                             fontFamily: font, cursor: 'pointer', opacity: isSyncing ? 0.5 : 1 }}>
                    {isSyncing ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'บันทึกการเปลี่ยนแปลง' : 'Save changes')}
                  </button>
                ) : selectedLoan.isPaid || selectedLoan.isScam || selectedLoan.isRenewed || selectedLoan.isWithdrawn ? (
                  <div style={{ textAlign: 'center', fontSize: 13, color: D_T.mute, padding: '8px 0' }}>
                    <DChip tone={getLoanTone(selectedLoan)}>{getLoanStatusText(selectedLoan)}</DChip>
                    <div style={{ marginTop: 8 }}>{lang === 'th' ? 'รายการนี้ปิดแล้ว' : 'This loan is closed'}</div>
                  </div>
                ) : (
                  <>
                    <button onClick={() => handleUpdateStatus('ชำระแล้ว')}
                      style={{ width: '100%', padding: '13px 0', borderRadius: 999, background: D_T.ink,
                               color: D_T.bg, border: 'none', fontSize: 14, fontWeight: 800,
                               fontFamily: font, cursor: 'pointer' }}>
                      {lang === 'th' ? `รับเงินแล้ว ${formatCurrency(selectedLoan.totalExpected)}` : `Got paid ${formatCurrency(selectedLoan.totalExpected)}`}
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleUpdateStatus('ต่อดอก')}
                        style={{ flex: 1, padding: '11px 0', borderRadius: 999, background: D_T.lavender,
                                 color: D_T.lavDeep, border: 'none', fontSize: 12, fontWeight: 700,
                                 fontFamily: font, cursor: 'pointer' }}>
                        {lang === 'th' ? 'ต่อสัญญาอีกรอบ' : 'Renew for another period'}
                      </button>
                      <button onClick={() => setShowConfirmDefault(true)}
                        style={{ flex: 1, padding: '11px 0', borderRadius: 999, background: D_T.blush,
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
                  <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {lang === 'th' ? 'กระแสเงินสด 30 วัน' : '30-day cashflow'}
                  </div>
                  <div style={{ fontSize: isDesktop ? 18 : 15, fontWeight: 800, letterSpacing: '-.02em', marginTop: 2 }}>
                    {lang === 'th' ? 'การวิเคราะห์ขั้นสูง' : 'Advanced Analysis'}
                  </div>
                </div>
                <button onClick={() => { setShowExpandedTrend(false); setInsightDate(null); }}
                  style={{ width: 32, height: 32, borderRadius: 99, background: 'rgba(27,31,42,.08)',
                           border: 'none', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>✕</button>
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
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: D_T.mute }} interval="preserveStartEnd" />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: D_T.mute }} width={46} />
                        <RechartsTooltip contentStyle={{ borderRadius: 10, border: `1px solid ${D_T.line}`, fontFamily: font, fontSize: 11 }} />
                        <Bar dataKey="Expected" barSize={10} fill={D_T.line} radius={[3,3,0,0]} name={lang === 'th' ? 'คาด' : 'Expected'} />
                        <Line type="monotone" dataKey="Received" stroke={D_T.mintDeep} strokeWidth={2.5} dot={false}
                          activeDot={{ r: 5, fill: D_T.mintDeep, stroke: D_T.bg, strokeWidth: 2 }}
                          name={lang === 'th' ? 'รับจริง' : 'Received'} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Date chips */}
                  <div>
                    <div style={{ fontSize: 9.5, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                                  textTransform: 'uppercase', marginBottom: 8 }}>
                      {lang === 'th' ? 'กดวันเพื่อดูรายละเอียด' : 'Tap a date to inspect'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {trendData30.map(d => {
                        const fullDate = labelToFullDate.get(d.date) ?? d.date;
                        const sel = insightDate === fullDate;
                        const hasData = d.Received > 0 || d.Expected > 0;
                        return (
                          <button key={d.date}
                            onClick={() => setInsightDate(sel ? null : fullDate)}
                            style={{ padding: '6px 10px', borderRadius: 8, border: sel ? 'none' : `1px solid ${D_T.line}`,
                                     cursor: 'pointer', fontFamily: mono, fontSize: 11, fontWeight: 700,
                                     background: sel ? D_T.ink : hasData ? D_T.mint + '55' : D_T.surface2,
                                     color: sel ? D_T.bg : hasData ? D_T.mintDeep : D_T.mute2,
                                     outline: 'none', transition: 'background .1s, color .1s' }}>
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
                      <div style={{ fontSize: 26, marginBottom: 8 }}>☝️</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D_T.ink2 }}>
                        {lang === 'th' ? 'กดวันด้านบนเพื่อดูรายละเอียด' : 'Select a date above to inspect'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Date badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                                    paddingBottom: 14, borderBottom: `1px solid ${D_T.line}` }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: D_T.lavender,
                                      color: D_T.lavDeep, display: 'grid', placeItems: 'center', fontSize: 15 }}>📅</div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{insightDate}</div>
                          <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                            Daily Insight
                          </div>
                        </div>
                        <button onClick={() => setInsightDate(null)}
                          style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 99,
                                   background: 'rgba(27,31,42,.06)', border: 'none', fontSize: 12, cursor: 'pointer' }}>✕</button>
                      </div>

                      {/* Expected due */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                                      textTransform: 'uppercase', marginBottom: 8 }}>
                          {lang === 'th' ? 'ดอกที่คาด' : 'Expected due'}
                        </div>
                        {expDue.length === 0 ? (
                          <div style={{ fontSize: 12, color: D_T.mute, fontStyle: 'italic' }}>
                            {lang === 'th' ? 'ไม่มีรายการ' : 'None'}
                          </div>
                        ) : expDue.map(l => (
                          <div key={'exp-' + l.id} onClick={() => { setInsightDate(null); setShowExpandedTrend(false); setSelectedLoan(l); }}
                            style={{ padding: '9px 12px', background: D_T.surface2, borderRadius: 10,
                                     border: `1px solid ${D_T.line}`, marginBottom: 6,
                                     display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                     cursor: 'pointer' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</div>
                              <div style={{ fontSize: 10.5, color: D_T.mute }}>{l.id}</div>
                            </div>
                            <div style={{ fontFamily: mono, fontWeight: 800, color: D_T.mintDeep, fontSize: 13 }}>
                              +{formatCurrency(l.expectedInterest)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Payments received */}
                      <div>
                        <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                                      textTransform: 'uppercase', marginBottom: 8 }}>
                          {lang === 'th' ? 'รับจริง' : 'Received'}
                        </div>
                        {expPaid.length === 0 ? (
                          <div style={{ fontSize: 12, color: D_T.mute, fontStyle: 'italic' }}>
                            {lang === 'th' ? 'ไม่มีการชำระ' : 'None'}
                          </div>
                        ) : expPaid.map(l => (
                          <div key={'act-' + l.id} onClick={() => { setInsightDate(null); setShowExpandedTrend(false); setSelectedLoan(l); }}
                            style={{ padding: '9px 12px', background: D_T.mint + '35', borderRadius: 10,
                                     border: `1px solid ${D_T.mint}`, marginBottom: 6,
                                     display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                     cursor: 'pointer' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</div>
                              <DChip tone="mint">{getLoanStatusText(l)}</DChip>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontFamily: mono, fontWeight: 800, color: D_T.mintDeep, fontSize: 13 }}>
                                +{formatCurrency(l.paidInterest)}
                              </div>
                              <div style={{ fontSize: 10.5, color: D_T.mute }}>{formatCurrency(l.paidPrincipal)}</div>
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

      {showWithdrawModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 16, background: 'rgba(27,31,42,.5)',
                      backdropFilter: 'blur(4px)' }}
          onClick={() => setShowWithdrawModal(false)}>
          <div style={{ background: D_T.surface, borderRadius: 22, width: '100%', maxWidth: 480,
                        overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '22px 26px 18px', borderBottom: `1px solid ${D_T.line}`,
                          background: D_T.surface2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'ถอนเงิน' : 'Withdraw'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4 }}>
                  {lang === 'th' ? 'บันทึกการเบิกเงิน' : 'Record a payout'}
                </div>
              </div>
              <button onClick={() => setShowWithdrawModal(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleWithdrawSubmit} style={{ padding: '24px 26px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'จำนวนเงิน' : 'Amount'}
                </label>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: D_T.surface2, border: `1.5px solid ${D_T.ink}`,
                              display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>฿</span>
                  <input type="number" required min="1" value={withdrawForm.principal}
                    onChange={e => setWithdrawForm({ ...withdrawForm, principal: e.target.value })}
                    placeholder="0"
                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 24, fontWeight: 800,
                             letterSpacing: '-.02em', color: D_T.ink, outline: 'none', fontFamily: mono,
                             marginLeft: 6, fontVariantNumeric: 'tabular-nums' }} />
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                  {[100, 500, 1000, 2000, 5000].map(amt => (
                    <button key={amt} type="button"
                      onClick={() => setWithdrawForm(f => ({ ...f, principal: String(Math.max(0, parseFloat(f.principal || '0') + amt)) }))}
                      style={{ padding: '5px 10px', borderRadius: 999, background: D_T.blush, color: D_T.blushDeep,
                               fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: font }}>
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'วันที่' : 'Date'}
                </label>
                <DatePicker selected={withdrawForm.date}
                  onChange={(date: Date | null) => setWithdrawForm({ ...withdrawForm, date: date ?? new Date() })}
                  dateFormat="dd/MM/yyyy" className="w-full" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Note (optional)'}
                </label>
                <input type="text" value={withdrawForm.name}
                  onChange={e => setWithdrawForm({ ...withdrawForm, name: e.target.value })}
                  placeholder={lang === 'th' ? 'ค่าใช้จ่าย...' : 'Expense...'}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${D_T.line}`,
                           background: D_T.surface2, fontSize: 14, color: D_T.ink, outline: 'none',
                           fontFamily: font, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, paddingTop: 4, borderTop: `1px solid ${D_T.line}` }}>
                <button type="button" onClick={() => setShowWithdrawModal(false)}
                  style={{ padding: '12px 16px', borderRadius: 999, background: D_T.surface,
                           color: D_T.ink, border: `1px solid ${D_T.line}`, fontSize: 13, fontWeight: 700,
                           cursor: 'pointer', fontFamily: font }}>
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button type="submit" disabled={isSyncing}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 999, background: D_T.ink,
                           color: D_T.bg, border: 'none', fontSize: 13, fontWeight: 700,
                           cursor: 'pointer', fontFamily: font, opacity: isSyncing ? 0.5 : 1 }}>
                  {isSyncing ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'ยืนยันการเบิก' : 'Confirm payout')}
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
            <div style={{ padding: '22px 26px 18px', borderBottom: `1px solid ${D_T.line}`,
                          background: D_T.surface2, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'สินเชื่อใหม่' : 'New loan'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4 }}>
                  {lang === 'th' ? 'ปล่อยกู้ให้ใคร' : 'Lend to someone'}
                </div>
                <div style={{ fontSize: 12, color: D_T.mute, marginTop: 4 }}>
                  {lang === 'th' ? 'แค่ 3 ช่อง ระบบคำนวณดอกและกำหนดให้' : 'Three details. Pocket figures out the rest.'}
                </div>
              </div>
              <button onClick={() => setShowNewLoanModal(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer', alignSelf: 'flex-start' }}>✕</button>
            </div>
            {/* Form */}
            <form onSubmit={handleCreateNewLoan} style={{ padding: '24px 26px 14px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', flex: 1 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'ใครจะกู้' : "Who's borrowing"}
                </label>
                <input type="text" required value={newLoanForm.name}
                  onChange={e => setNewLoanForm({ ...newLoanForm, name: e.target.value })}
                  placeholder={lang === 'th' ? 'ชื่อผู้กู้' : 'Borrower name'}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12,
                           border: newLoanForm.name ? `1.5px solid ${D_T.ink}` : `1px solid ${D_T.line}`,
                           background: D_T.surface2, fontSize: 15, fontWeight: 600, color: D_T.ink,
                           outline: 'none', fontFamily: font, boxSizing: 'border-box' }} />
                {/* Quick-select from existing borrowers */}
                {data.loans.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {[...new Set(data.loans.map(l => l.name))].slice(0, 4).map(name => (
                      <span key={name} onClick={() => setNewLoanForm(f => ({ ...f, name }))}
                        style={{ padding: '5px 10px', borderRadius: 999, background: D_T.surface2,
                                 fontSize: 11, fontWeight: 600, color: D_T.ink2,
                                 border: `1px solid ${D_T.line}`, cursor: 'pointer' }}>
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount + days */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    {lang === 'th' ? 'เงินต้น' : 'Principal'}
                  </label>
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: D_T.surface2,
                                border: `1px solid ${D_T.line}`, display: 'flex', alignItems: 'baseline', overflow: 'hidden' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, flexShrink: 0 }}>฿</span>
                    <input type="number" required min="1" value={newLoanForm.principal}
                      onChange={e => setNewLoanForm({ ...newLoanForm, principal: e.target.value })}
                      style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 22, fontWeight: 800,
                               letterSpacing: '-.02em', color: D_T.ink, outline: 'none', fontFamily: mono,
                               marginLeft: 4, fontVariantNumeric: 'tabular-nums', width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                    {['500', '1000', '1500', '2000', '3000'].map((p, i) => (
                      <span key={p} onClick={() => setNewLoanForm(f => ({ ...f, principal: p }))}
                        style={{ padding: '5px 9px', borderRadius: 999, cursor: 'pointer',
                                 background: newLoanForm.principal === p ? D_T.ink : D_T.surface2,
                                 color: newLoanForm.principal === p ? D_T.bg : D_T.ink2,
                                 fontSize: 11, fontWeight: 700, border: newLoanForm.principal === p ? 'none' : `1px solid ${D_T.line}` }}>
                        {parseInt(p) >= 1000 ? (parseInt(p)/1000) + 'k' : p}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    {lang === 'th' ? 'นานเท่าไหร่' : 'For how long'}
                  </label>
                  <div style={{ padding: '8px 8px 8px 14px', borderRadius: 12, background: D_T.surface2,
                                border: `1px solid ${D_T.line}`, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <input type="number" min="1" value={newLoanForm.daysBorrowed}
                      onChange={e => handleDaysChange(Number(e.target.value))}
                      style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 22, fontWeight: 800,
                               letterSpacing: '-.02em', color: D_T.ink, outline: 'none', fontFamily: mono,
                               fontVariantNumeric: 'tabular-nums', minWidth: 0 }} />
                    <span style={{ fontSize: 13, color: D_T.mute }}>{lang === 'th' ? 'วัน' : 'd'}</span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button type="button" onClick={() => handleDaysChange(newLoanForm.daysBorrowed - 1)}
                        style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${D_T.line}`,
                                 background: D_T.surface, color: D_T.ink, fontSize: 14, fontWeight: 700,
                                 cursor: 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1 }}>−</button>
                      <button type="button" onClick={() => handleDaysChange(newLoanForm.daysBorrowed + 1)}
                        style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${D_T.line}`,
                                 background: D_T.surface, color: D_T.ink, fontSize: 14, fontWeight: 700,
                                 cursor: 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1 }}>+</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {[3, 5, 7].map(d => (
                      <span key={d} onClick={() => handleDaysChange(d)}
                        style={{ padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                                 background: newLoanForm.daysBorrowed === d ? D_T.ink : D_T.surface2,
                                 color: newLoanForm.daysBorrowed === d ? D_T.bg : D_T.ink2,
                                 fontSize: 11, fontWeight: 700, border: newLoanForm.daysBorrowed === d ? 'none' : `1px solid ${D_T.line}` }}>
                        {d}{lang === 'th' ? 'ว' : 'd'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Start date */}
              <div>
                <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'วันที่เริ่ม' : 'Start date'}
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <DatePicker selected={newLoanForm.borrowDate} onChange={handleBorrowDateChange} dateFormat="dd/MM/yyyy" className="w-full" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <DatePicker selected={newLoanForm.dueDate} onChange={handleDueDateChange} dateFormat="dd/MM/yyyy" className="w-full" />
                  </div>
                </div>
              </div>

              {/* Interest rate */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {lang === 'th' ? 'อัตราดอกเบี้ย' : 'Interest rate'}
                  </label>
                  <span style={{ fontSize: 11, color: D_T.mute }}>{lang === 'th' ? 'ต่อรอบสัญญา' : 'per loan period'}</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: D_T.mint,
                              display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="number" min="0" value={newLoanForm.interestRate}
                    onChange={e => setNewLoanForm({ ...newLoanForm, interestRate: Number(e.target.value) })}
                    style={{ width: 60, border: 'none', background: 'transparent', fontSize: 22, fontWeight: 800,
                             letterSpacing: '-.02em', color: D_T.ink, outline: 'none', fontFamily: mono }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: D_T.mintDeep }}>%</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: D_T.mintDeep, marginLeft: 'auto' }}>
                    ≈ {formatCurrency((parseFloat(newLoanForm.principal || '0') * newLoanForm.interestRate) / 100)}
                  </span>
                </div>
              </div>

              {/* Preview */}
              <div style={{ padding: 16, borderRadius: 14, background: D_T.surface2, border: `1px dashed ${D_T.line}` }}>
                <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {lang === 'th' ? 'ตัวอย่าง' : "Here's how it'll look"}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {([
                    [lang === 'th' ? 'คุณให้' : 'You give', formatCurrency(parseFloat(newLoanForm.principal || '0')), D_T.ink],
                    [lang === 'th' ? 'เขาคืน' : 'They owe', formatCurrency(parseFloat(newLoanForm.principal || '0') + (parseFloat(newLoanForm.principal || '0') * newLoanForm.interestRate) / 100), D_T.ink],
                    [lang === 'th' ? 'กำหนด' : 'Due', newLoanForm.dueDate.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' }), D_T.mintDeep],
                  ] as [string, string, string][]).map(([lbl, v, c]) => (
                    <div key={lbl}>
                      <div style={{ fontSize: 10.5, color: D_T.mute, fontWeight: 600 }}>{lbl}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: c, marginTop: 4,
                                    letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note / Remark */}
              <div>
                <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em',
                                 textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  {lang === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Note (optional)'}
                </label>
                <textarea rows={2} value={newLoanForm.note}
                  onChange={e => setNewLoanForm({ ...newLoanForm, note: e.target.value })}
                  placeholder={lang === 'th' ? 'เพิ่มหมายเหตุหรือรายละเอียดเพิ่มเติม...' : 'Add a note or extra details...'}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 12,
                           border: `1px solid ${D_T.line}`, background: D_T.surface2,
                           fontSize: 13, color: D_T.ink, outline: 'none', fontFamily: font,
                           boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            </form>
            {/* Footer */}
            <div style={{ padding: '16px 26px 22px', display: 'flex', gap: 10,
                          borderTop: `1px solid ${D_T.line}`, background: D_T.surface2 }}>
              <button type="button" onClick={() => setShowNewLoanModal(false)}
                style={{ padding: '12px 16px', borderRadius: 999, background: D_T.surface,
                         color: D_T.ink, border: `1px solid ${D_T.line}`, fontSize: 13, fontWeight: 700,
                         cursor: 'pointer', fontFamily: font }}>
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button onClick={handleCreateNewLoan} disabled={isSyncing || !newLoanForm.name}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 999, background: D_T.ink,
                         color: D_T.bg, border: 'none', fontSize: 13, fontWeight: 700,
                         cursor: 'pointer', fontFamily: font, opacity: isSyncing || !newLoanForm.name ? 0.5 : 1 }}>
                {isSyncing ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') :
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
          <div style={{ background: D_T.surface, borderRadius: 22, width: '100%', maxWidth: 400,
                        overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${D_T.line}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: D_T.surface2 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {lang === 'th' ? 'การแจ้งเตือน' : 'Notifications'}
              </div>
              <button onClick={() => setShowNotifModal(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 14, textAlign: 'center',
                            background: isSubscribed ? D_T.mint + '40' : notifPermission === 'denied' ? D_T.blush + '40' : D_T.surface2,
                            border: `1px solid ${isSubscribed ? D_T.mint : notifPermission === 'denied' ? D_T.blush : D_T.line}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isSubscribed ? D_T.mintDeep : notifPermission === 'denied' ? D_T.blushDeep : D_T.ink2 }}>
                  {isSubscribed ? (lang === 'th' ? '🔔 เปิดใช้งานแล้ว' : '🔔 Notifications enabled') :
                   notifPermission === 'denied' ? (lang === 'th' ? '🚫 ถูกบล็อก' : '🚫 Blocked by browser') :
                   (lang === 'th' ? '🔕 ปิดอยู่' : '🔕 Not enabled')}
                </div>
              </div>
              {isSubscribed && (
                <div>
                  <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {lang === 'th' ? 'ทดสอบ' : 'Test'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => handleTestNotif('morning')} disabled={isSendingTestNotif}
                      style={{ padding: '10px 0', borderRadius: 12, background: D_T.lavender, color: D_T.lavDeep,
                               border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                      {lang === 'th' ? 'เช้า' : 'Morning'}
                    </button>
                    <button onClick={() => handleTestNotif('afternoon')} disabled={isSendingTestNotif}
                      style={{ padding: '10px 0', borderRadius: 12, background: D_T.lavender, color: D_T.lavDeep,
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
                             color: D_T.bg, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                    {lang === 'th' ? 'เปิดการแจ้งเตือน' : 'Enable notifications'}
                  </button>
                )}
                {isSubscribed && (
                  <button onClick={handleDisableNotif}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 999, background: D_T.blush,
                             color: D_T.blushDeep, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                    {lang === 'th' ? 'ปิดการแจ้งเตือน' : 'Disable notifications'}
                  </button>
                )}
                <button onClick={() => setShowNotifModal(false)}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 999, background: D_T.surface2,
                           color: D_T.ink2, border: `1px solid ${D_T.line}`, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
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
            <motion.div style={{ position: 'relative', padding: '0 24px 112px', display: 'flex', flexDirection: 'column', gap: 12 }}
              initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowFabMenu(false); setShowNewLoanModal(true); }}
                style={{ width: '100%', padding: '16px 0', borderRadius: 20, background: D_T.ink,
                         color: D_T.bg, border: 'none', fontSize: 15, fontWeight: 800,
                         cursor: 'pointer', fontFamily: font, boxShadow: '0 8px 24px rgba(27,31,42,.3)' }}>
                {lang === 'th' ? '+ ปล่อยกู้' : '+ Lend money'}
              </button>
              <button onClick={() => { setShowFabMenu(false); setShowWithdrawModal(true); }}
                style={{ width: '100%', padding: '16px 0', borderRadius: 20, background: D_T.surface,
                         color: D_T.ink, border: `1px solid ${D_T.line}`, fontSize: 15, fontWeight: 800,
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
            <motion.div style={{ background: D_T.surface, borderRadius: 22, width: '100%', maxWidth: 360,
                                  overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)' }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: D_T.blush,
                              display: 'grid', placeItems: 'center', margin: '0 auto 16px',
                              fontSize: 24 }}>💀</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: D_T.ink, marginBottom: 8 }}>
                  {lang === 'th' ? 'ยืนยันหนี้เสีย?' : 'Confirm Default?'}
                </div>
                <div style={{ fontSize: 13, color: D_T.mute, marginBottom: 24, lineHeight: 1.5 }}>
                  {lang === 'th' ? 'รายการนี้จะถูกบันทึกว่าโดนบิด ยากที่จะยกเลิก' : 'This loan will be marked as defaulted. Hard to undo.'}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowConfirmDefault(false)}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 999, background: D_T.surface2,
                             color: D_T.ink2, border: `1px solid ${D_T.line}`, fontSize: 13, fontWeight: 700,
                             cursor: 'pointer', fontFamily: font }}>
                    {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button onClick={() => { setShowConfirmDefault(false); handleUpdateStatus('โดนบิด'); }}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 999, background: D_T.blushDeep,
                             color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
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
          <div style={{ background: D_T.surface, borderRadius: 22, width: '100%', maxWidth: 380,
                        overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(27,31,42,.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${D_T.line}`, background: D_T.surface2,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'รายละเอียดกำไร' : 'Profit Breakdown'}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, fontVariantNumeric: 'tabular-nums',
                              fontFamily: mono, color: s.netProfit >= 0 ? D_T.mintDeep : D_T.blushDeep }}>
                  {formatCurrency(s.netProfit)}
                </div>
              </div>
              <button onClick={() => setShowProfitModal(false)}
                style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(27,31,42,.06)',
                         border: 'none', fontSize: 14, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                [lang === 'th' ? 'ดอกที่ได้รับ' : 'Interest received', s.paidInterest, D_T.mint, D_T.mintDeep, '+'],
                [lang === 'th' ? 'หักโดนบิด' : 'Defaults', s.scamPrincipal, D_T.blush, D_T.blushDeep, '−'],
                [lang === 'th' ? 'หักเบิก' : 'Withdrawals', s.withdrawn, D_T.butter, D_T.butterDeep, '−'],
              ].map(([label, val, bg, fg, sign]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      padding: '10px 14px', borderRadius: 12, background: bg as string + '40' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: fg as string }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: fg as string, fontFamily: mono }}>{sign}{formatCurrency(val as number)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px',
                            borderTop: `1.5px solid ${D_T.ink}`, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {lang === 'th' ? 'กำไรสุทธิ' : 'Net Profit'}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: mono,
                               color: s.netProfit >= 0 ? D_T.mintDeep : D_T.blushDeep }}>
                  {formatCurrency(s.netProfit)}
                </span>
              </div>
              <div style={{ padding: '14px', borderRadius: 14, background: D_T.lavender + '40',
                            border: `1px solid ${D_T.lavender}` }}>
                <div style={{ fontSize: 11, color: D_T.lavDeep, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {lang === 'th' ? 'ดอกรอรับ' : 'Unrealized Interest'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: D_T.ink2 }}>{lang === 'th' ? 'ดอกที่ยังไม่ถึงกำหนด' : 'Pending'}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: mono, color: D_T.lavDeep }}>+{formatCurrency(s.unpaidInterest)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${D_T.lavender}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: D_T.lavDeep }}>{lang === 'th' ? 'รวมถ้าเก็บครบ' : 'Total if collected'}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: mono, color: D_T.lavDeep }}>
                    {formatCurrency(s.paidInterest + s.unpaidInterest - s.scamPrincipal - s.withdrawn)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '12px', borderRadius: 12, background: D_T.surface2, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: mono }}>{s.profitPct.toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
                    {lang === 'th' ? 'yield ต่อทุน' : 'Yield on capital'}
                  </div>
                </div>
                <div style={{ padding: '12px', borderRadius: 12, background: D_T.surface2, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: mono }}>{formatCurrency(s.paidInterest)}</div>
                  <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
                    {lang === 'th' ? 'ดอกสะสม' : 'Total interest'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }} className="animate-slide-up">
          <div style={{ padding: '12px 20px', borderRadius: 14, background: toastMessage.type === 'success' ? D_T.mintDeep : D_T.blushDeep,
                        color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10,
                        boxShadow: '0 8px 24px rgba(27,31,42,.3)', fontFamily: font }}>
            {toastMessage.type === 'success' ? '✓' : '⚠'} {toastMessage.text}
          </div>
        </div>
      )}
    </div>
  );
}
