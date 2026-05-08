import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fetchAppData, AppData, LoanRecord, updateLoanStatus, createNewLoan, editExistingLoan } from './services/dataService';
import { formatCurrency, formatNumber, parseThaiDate } from './lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, CalendarClock, Activity, List, X, CheckCircle2, UserX, Wallet, RefreshCcw, LineChart, Bell, BellOff, Home, BarChart2, Languages, Search, Plus } from 'lucide-react';
import { ResponsiveContainer, Tooltip as RechartsTooltip, Legend, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush, getNotificationPermission, sendTestNotification } from './services/pushService';
import { t, Lang } from './lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: string;
  sub: React.ReactNode;
  subColor?: string;
  icon: React.ElementType;
  iconBg: string;
  onClick?: () => void;
}

function MetricCard({ label, value, sub, subColor = 'emerald', icon: Icon, iconBg, onClick }: MetricCardProps) {
  return (
    <div
      className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm card-lift overflow-hidden relative ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all active:scale-95' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider leading-tight">{label}</div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-xl font-black text-slate-800 leading-none mb-1.5">{value}</div>
      <div className={`text-[10px] font-semibold flex items-center gap-0.5 text-${subColor}-600`}>{sub}</div>
    </div>
  );
}

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
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'loans' | 'analytics'>('dashboard');
  const [isDesktop, setIsDesktop] = useState(true);

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
    interestRate: 35
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
    const trendData14 = sortedDates.slice(-14).map(date => ({ date: date.substring(0, 5), Expected: dateMap[date].expected, Received: dateMap[date].actual }));
    const trendData30 = sortedDates.slice(-30).map(date => ({ date: date.substring(0, 5), Expected: dateMap[date].expected, Received: dateMap[date].actual }));
    return { trendData14, trendData30, labelToFullDate };
  }, [data]);

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

  const loadData = async (quiet = false) => {
    if (!quiet) setIsSyncing(true);
    try {
      const newData = await fetchAppData();
      if (newData) setData(newData);
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
        interestRate: newLoanForm.interestRate
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2027 100%)' }}>
        {/* Ambient glow orbs */}
        <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-30" style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />
        <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-20" style={{ background: 'radial-gradient(circle, #6366f1, transparent)', animationDelay: '1s' }} />

        <div className="flex flex-col items-center relative z-10 px-8 text-center">
          {/* Logo */}
          <div className="relative mb-10">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl border border-white/10" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(99,102,241,0.2))', backdropFilter: 'blur(16px)' }}>
              <Activity className="w-12 h-12 text-emerald-400 stroke-[2.5px]" />
            </div>
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-3xl border-2 border-emerald-500/30 animate-ping" style={{ animationDuration: '2s' }} />
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white mb-1">
            <span style={{ background: 'linear-gradient(90deg, #34d399, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('appTitle', lang)}</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mb-8">{t('appSubtitle', lang)}</p>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
          </div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-[0.2em] mt-3">{t('syncingData', lang)}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-rose-100 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-rose-500" />
          </div>
          <h2 className="text-lg font-black text-slate-800 mb-1">ไม่สามารถเชื่อมต่อได้</h2>
          <p className="text-slate-500 text-sm">Failed to sync with the central database. Please check your connection.</p>
          <button onClick={() => window.location.reload()} className="mt-6 w-full py-3 bg-rose-600 text-white font-bold rounded-xl text-sm hover:bg-rose-700 transition-colors">ลองใหม่</button>
        </div>
      </div>
    );
  }

  const s = data.summary;

  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('ชำระแล้ว') || s.includes('paid') || s.includes('ปิดยอด')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-200">{t('statusPaid', lang)}</span>;
    }
    if (s.includes('ต่อดอก') || s.includes('renew')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider border border-indigo-200">{t('statusRenewed', lang)}</span>;
    }
    if (s.includes('บิด') || s.includes('default')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider border border-rose-200">{t('statusDefaulted', lang)}</span>;
    }
    if (s.includes('เบิก') || s.includes('withdraw') || s.includes('payout')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider border border-amber-200">{t('statusPayout', lang)}</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider border border-slate-200">{t('statusActive', lang)}</span>;
  };

  const MetricRow = () => (
    <div className="grid grid-cols-2 mb-4 gap-3 md:grid-cols-4 md:mb-6">
      <MetricCard
        label={t('totalPortfolio', lang)}
        value={formatCurrency(s.totalLimit)}
        sub={<><TrendingUp className="w-3 h-3" /> {t('activeLimit', lang)}</>}
        subColor="emerald"
        icon={TrendingUp}
        iconBg="bg-emerald-100 text-emerald-600"
      />
      <MetricCard
        label={t('netProfit', lang)}
        value={formatCurrency(s.netProfit)}
        sub={<><TrendingUp className="w-3 h-3" /> {s.profitPct.toFixed(1)}% {t('margin', lang)}</>}
        subColor={s.netProfit >= 0 ? 'emerald' : 'rose'}
        icon={LineChart}
        iconBg="bg-indigo-100 text-indigo-600"
        onClick={() => setShowProfitModal(true)}
      />
      <MetricCard
        label={t('nplRatio', lang)}
        value={((s.scamPrincipal / Math.max(1, s.totalBorrowed)) * 100).toFixed(1) + '%'}
        sub={<><TrendingDown className="w-3 h-3" /> {formatCurrency(s.scamPrincipal)} {t('lost', lang)}</>}
        subColor="rose"
        icon={TrendingDown}
        iconBg="bg-rose-100 text-rose-600"
      />
      <MetricCard
        label={t('availableBalance', lang)}
        value={formatCurrency(s.available)}
        sub={t('readyToLend', lang)}
        subColor="slate"
        icon={Wallet}
        iconBg="bg-amber-100 text-amber-600"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-32 md:pb-8">
      {/* Sticky Mobile Header */}
      <header className="sticky top-0 z-30 md:hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="flex justify-between items-center px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Activity className="w-4.5 h-4.5 text-white" style={{ width: '18px', height: '18px' }} />
            </div>
            <h1 className="text-base font-black tracking-tight text-white">
              {t('appTitle', lang)}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleLang}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 text-[10px] font-black transition-colors"
            >
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <button
              onClick={() => setShowNotifModal(true)}
              className={`relative w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isSubscribed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/50'}`}
            >
              {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              {isSubscribed && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-slate-900"></span>}
            </button>
            {isSyncing ? (
              <div className="w-8 h-8 flex items-center justify-center">
                <RefreshCcw className="w-4 h-4 text-emerald-400 animate-spin" />
              </div>
            ) : (
              <button onClick={() => loadData()} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/60">
                <RefreshCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {/* Current tab subtitle */}
        <div className="px-4 pb-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
          {activeMobileTab === 'dashboard' ? t('navDashboard', lang) : activeMobileTab === 'analytics' ? t('navAnalytics', lang) : t('navLoans', lang)}
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-4 md:px-8 md:py-8">
        {/* Desktop Header */}
        <header className="hidden md:flex mb-8 justify-between items-center border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-100">
                <Activity className="w-8 h-8 text-white" />
              </div>
              {t('appTitle', lang)}
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm font-medium">{t('appSubtitle', lang)}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLang}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-bold transition-all shadow-sm"
            >
              <Languages className="w-4 h-4" />
              {lang === 'th' ? 'English' : 'ภาษาไทย'}
            </button>
            <button
              onClick={() => setShowNotifModal(true)}
              className={`relative p-3 rounded-xl transition-all shadow-sm ${isSubscribed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-white text-slate-400 border border-slate-200'}`}
            >
              {isSubscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              {isSubscribed && <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>}
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-100 transition-all active:scale-95"
            >
              <Wallet className="w-4 h-4" /> {t('withdraw', lang)}
            </button>
            <button
              onClick={() => setShowNewLoanModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              <Activity className="w-4 h-4" /> {t('newLoan', lang)}
            </button>
            {isSyncing ? (
              <span className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-100 text-sm font-bold">
                <RefreshCcw className="w-4 h-4 animate-spin" />
                {t('syncingData', lang)}
              </span>
            ) : (
              <button onClick={() => loadData()} className="p-3 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200 bg-white">
                <RefreshCcw className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* Main Content Sections with Animation */}
        <AnimatePresence mode="wait">
          {(isDesktop || activeMobileTab === 'dashboard') && (
            <motion.div
              key="dashboard"
              initial={isDesktop ? false : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={isDesktop ? undefined : { opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="md:block"
            >
              <MetricRow />

              {/* Section 2: Action & Alerts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Due Today */}
                <div className="bg-white rounded-2xl border border-amber-100 flex flex-col shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
                    <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase tracking-wider">
                      <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
                        <CalendarClock className="w-3.5 h-3.5 text-white" />
                      </div>
                      {t('dueToday', lang)}
                    </div>
                    <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{dueTodayLoans.length}</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[220px] overflow-y-auto no-scrollbar">
                    {dueTodayLoans.length === 0 ? (
                      <div className="py-8 text-center">
                        <div className="text-2xl mb-1">✅</div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('noCollectionsToday', lang)}</p>
                      </div>
                    ) : (
                      <div ref={dueListRef}>
                        {dueTodayLoans.map(l => (
                          <div
                            key={l.id}
                            onClick={() => setSelectedLoan(l)}
                            className="flex justify-between items-center px-4 py-3 active:bg-amber-50 transition-colors cursor-pointer border-l-[3px] border-amber-400"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-amber-700 text-xs font-black">{l.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 text-sm leading-tight">{l.name}</div>
                                <div className="text-[10px] font-medium text-slate-400">{l.id}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-amber-600 text-sm">{formatCurrency(l.totalExpected)}</span>
                              <span className="text-slate-300">›</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Overdue Alerts */}
                <div className="bg-white rounded-2xl border border-rose-100 flex flex-col shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)' }}>
                    <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wider">
                      <div className="w-6 h-6 bg-rose-500 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-3.5 h-3.5 text-white" />
                      </div>
                      {t('overdueAlerts', lang)}
                    </div>
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{overdueLoans.length}</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[220px] overflow-y-auto no-scrollbar">
                    {overdueLoans.length === 0 ? (
                      <div className="py-8 text-center">
                        <div className="text-2xl mb-1">🎉</div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('noOverdueAccounts', lang)}</p>
                      </div>
                    ) : (
                      <div ref={overdueListRef}>
                        {overdueLoans.sort((a, b) => b.daysLate - a.daysLate).map(l => (
                          <div
                            key={l.id}
                            onClick={() => setSelectedLoan(l)}
                            className="flex justify-between items-center px-4 py-3 active:bg-rose-50 transition-colors cursor-pointer border-l-[3px] border-rose-500"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-rose-700 text-xs font-black">{l.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 text-sm leading-tight">{l.name}</div>
                                <div className="text-[10px] font-bold text-rose-600">{l.daysLate} {t('daysOverdue', lang)}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="font-black text-rose-600 text-sm">{formatCurrency(l.totalExpected)}</div>
                                <div className="text-[9px] text-slate-400">{l.dueDate}</div>
                              </div>
                              <span className="text-slate-300">›</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Analytics Content with Animation */}
          {(isDesktop || activeMobileTab === 'analytics') && (
            <motion.div
              key="analytics"
              initial={isDesktop ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={isDesktop ? undefined : { opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="md:block"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-black text-slate-800">{t('portfolioAnalytics', lang)}</h2>
                <span className="md:hidden text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider border border-slate-200">
                  {new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col cursor-pointer group hover:border-indigo-300 hover:shadow-md transition-all mb-4"
                onClick={() => setShowExpandedTrend(true)}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('cashflowTrend', lang)}</h3>
                  <span className="text-xs text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full font-bold border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">{t('clickToExpand', lang)}</span>
                </div>
                <div className="h-[160px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData14}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <YAxis axisLine={false} tickLine={false} hide />
                      <Bar dataKey="Expected" barSize={12} fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="Received" stroke="#10B981" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  {lang === 'th' ? 'สรุปรายเดือน' : 'Monthly Summary'}
                </div>
                {monthlySummary.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">{lang === 'th' ? 'ยังไม่มีข้อมูล' : 'No data yet'}</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {monthlySummary.map(m => {
                      const d = new Date(m.year, m.month, 1);
                      const label = d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: 'numeric' });
                      const net = m.interest - m.scam - m.withdrawn;
                      return (
                        <div key={m.key} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{label}</div>
                              <div className="text-[10px] text-slate-400">{m.count} {lang === 'th' ? 'รายการ' : 'records'}</div>
                            </div>
                            <div className={`px-2.5 py-1 rounded-full text-xs font-black ${net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {net >= 0 ? '+' : ''}{formatCurrency(net)}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-emerald-50 rounded-xl px-2 py-2 text-center">
                              <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide mb-0.5">{lang === 'th' ? 'รายได้' : 'Income'}</div>
                              <div className="text-xs font-black text-emerald-700">{formatCurrency(m.interest)}</div>
                            </div>
                            <div className="bg-rose-50 rounded-xl px-2 py-2 text-center">
                              <div className="text-[9px] font-bold text-rose-600 uppercase tracking-wide mb-0.5">{lang === 'th' ? 'โดนบิด' : 'Default'}</div>
                              <div className="text-xs font-black text-rose-700">{formatCurrency(m.scam)}</div>
                            </div>
                            <div className="bg-amber-50 rounded-xl px-2 py-2 text-center">
                              <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">{lang === 'th' ? 'เบิก' : 'Withdraw'}</div>
                              <div className="text-xs font-black text-amber-700">{formatCurrency(m.withdrawn)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('totalExpectedValue', lang)}</div>
                    <div className="text-xl font-black text-slate-800">{formatCurrency(s.totalExpected)}</div>
                  </div>
                  <div className="bg-emerald-600 p-4 rounded-2xl border border-emerald-500 shadow-lg shadow-emerald-100 flex flex-col items-center text-center">
                    <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-2">{t('totalCollected', lang)}</div>
                    <div className="text-xl font-black text-white">{formatCurrency(s.totalPaid)}</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                    {t('principalBreakdown', lang)}
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600">{t('principalLentOut', lang)}</span>
                      <span className="text-sm font-black text-slate-800">{formatCurrency(s.totalBorrowed)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-3 border-l-2 border-emerald-400">
                      <span className="text-xs font-bold text-emerald-600">{t('principalCollected', lang)}</span>
                      <span className="text-sm font-black text-emerald-700">{formatCurrency(s.paidPrincipal)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-3 border-l-2 border-amber-400">
                      <span className="text-xs font-bold text-amber-600">{t('principalRemaining', lang)}</span>
                      <span className="text-sm font-black text-amber-700">{formatCurrency(s.unpaidPrincipal)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-3 border-l-2 border-rose-400">
                      <span className="text-xs font-bold text-rose-600">{t('principalLost', lang)}</span>
                      <span className="text-sm font-black text-rose-700">{formatCurrency(s.scamPrincipal)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    {t('interestBreakdown', lang)}
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600">{t('interestExpected', lang)}</span>
                      <span className="text-sm font-black text-slate-800">{formatCurrency(s.totalInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-3 border-l-2 border-emerald-400">
                      <span className="text-xs font-bold text-emerald-600">{t('interestCollected', lang)}</span>
                      <span className="text-sm font-black text-emerald-700">{formatCurrency(s.paidInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-3 border-l-2 border-amber-400">
                      <span className="text-xs font-bold text-amber-600">{t('interestRemaining', lang)}</span>
                      <span className="text-sm font-black text-amber-700">{formatCurrency(s.unpaidInterest)}</span>
                    </div>
                  </div>
                </div>

                {/* Portfolio Analysis */}
                {(() => {
                  const principalRecovery = s.totalBorrowed > 0 ? (s.paidPrincipal / s.totalBorrowed) * 100 : 0;
                  const interestCollection = s.totalInterest > 0 ? (s.paidInterest / s.totalInterest) * 100 : 0;
                  const nplRate = s.totalBorrowed > 0 ? (s.scamPrincipal / s.totalBorrowed) * 100 : 0;
                  const realizedYield = s.paidPrincipal > 0 ? (s.paidInterest / s.paidPrincipal) * 100 : 0;
                  const overdueCapital = data.loans.filter(l => l.isOverdue && !l.isPaid && !l.isScam).reduce((sum, l) => sum + l.principal, 0);
                  const activeCount = data.loans.filter(l => !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn).length;
                  const overdueCount = data.loans.filter(l => l.isOverdue && !l.isPaid && !l.isScam).length;

                  let healthMsg = '';
                  let healthColor = '';
                  if (nplRate === 0 && overdueCount === 0) {
                    healthMsg = lang === 'th' ? '✅ พอร์ตสุขภาพดีมาก ไม่มีหนี้เสียและค้างชำระ' : '✅ Excellent portfolio health — no defaults or overdue.';
                    healthColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (nplRate > 20 || overdueCount > activeCount * 0.5) {
                    healthMsg = lang === 'th' ? '⚠️ ความเสี่ยงสูง ควรติดตามลูกหนี้ที่ค้างชำระอย่างเร่งด่วน' : '⚠️ High risk — follow up on overdue accounts urgently.';
                    healthColor = 'bg-rose-50 text-rose-700 border-rose-200';
                  } else if (nplRate > 10 || overdueCount > 0) {
                    healthMsg = lang === 'th' ? `🔶 ควรติดตาม ${overdueCount} รายการที่ค้างชำระ NPL ${nplRate.toFixed(1)}%` : `🔶 Monitor ${overdueCount} overdue accounts. NPL ${nplRate.toFixed(1)}%`;
                    healthColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  } else {
                    healthMsg = lang === 'th' ? `✅ พอร์ตอยู่ในเกณฑ์ดี อัตราเรียกคืน ${principalRecovery.toFixed(0)}%` : `✅ Portfolio in good shape. Recovery rate ${principalRecovery.toFixed(0)}%`;
                    healthColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  }

                  return (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-violet-500 rounded-full" />
                        {lang === 'th' ? 'การวิเคราะห์พอร์ต' : 'Portfolio Analysis'}
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="space-y-3">
                          {[
                            { label: lang === 'th' ? 'เรียกคืนต้นทุน' : 'Principal Recovery', value: principalRecovery, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
                            { label: lang === 'th' ? 'เก็บดอกเบี้ย' : 'Interest Collected', value: interestCollection, color: 'bg-indigo-500', textColor: 'text-indigo-700' },
                            { label: lang === 'th' ? 'หนี้เสีย (NPL)' : 'NPL Rate', value: nplRate, color: nplRate > 20 ? 'bg-rose-500' : nplRate > 10 ? 'bg-amber-500' : 'bg-emerald-500', textColor: nplRate > 20 ? 'text-rose-700' : nplRate > 10 ? 'text-amber-700' : 'text-emerald-700' },
                          ].map(item => (
                            <div key={item.label}>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-bold text-slate-600">{item.label}</span>
                                <span className={`text-xs font-black ${item.textColor}`}>{item.value.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${item.color}`} style={{ width: `${Math.min(100, item.value)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
                            <div className="text-lg font-black text-violet-700">{realizedYield.toFixed(1)}%</div>
                            <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mt-0.5">{lang === 'th' ? 'ผลตอบแทนจริง' : 'Realized Yield'}</div>
                          </div>
                          <div className={`rounded-xl p-3 border ${overdueCapital > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className={`text-lg font-black ${overdueCapital > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(overdueCapital)}</div>
                            <div className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${overdueCapital > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {lang === 'th' ? 'ต้นที่ค้างชำระ' : 'Overdue Capital'}
                            </div>
                            <div className={`text-[10px] mt-0.5 ${overdueCapital > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{overdueCount} / {activeCount} {lang === 'th' ? 'รายการ' : 'accounts'}</div>
                          </div>
                        </div>
                        <div className={`rounded-xl p-3 border text-xs font-semibold leading-relaxed ${healthColor}`}>{healthMsg}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}

          {/* Loans Content with Animation */}
          {(isDesktop || activeMobileTab === 'loans') && (
            <motion.div
              key="loans"
              initial={isDesktop ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={isDesktop ? undefined : { opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="md:block"
            >
              <h2 className="text-base font-bold mb-3 text-slate-800">{t('dataManagement', lang)}</h2>

              {/* Search + Sort bar */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={lang === 'th' ? 'ค้นหาชื่อหรือรหัส...' : 'Search name or ID...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="default">{lang === 'th' ? 'ล่าสุด' : 'Latest'}</option>
                  <option value="amount-desc">{lang === 'th' ? 'มากสุด ↓' : 'Highest ↓'}</option>
                  <option value="amount-asc">{lang === 'th' ? 'น้อยสุด ↑' : 'Lowest ↑'}</option>
                  <option value="overdue">{lang === 'th' ? 'ค้างนาน' : 'Most Overdue'}</option>
                  <option value="name">{lang === 'th' ? 'ชื่อ A-Z' : 'Name A-Z'}</option>
                </select>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
                  {(['all', 'renewals', 'paid', 'defaulted', 'withdrawn', 'raw'] as const).map(tab => (
                    <button
                      key={tab}
                      className={`px-4 py-3 text-xs font-semibold capitalize border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === tab ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500'}`}
                      onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
                    >
                      {tab === 'all' ? t('tabAll', lang) :
                        tab === 'renewals' ? t('tabRenewals', lang) :
                          tab === 'paid' ? t('tabPaid', lang) :
                            tab === 'defaulted' ? t('tabDefaulted', lang) :
                              tab === 'withdrawn' ? t('tabWithdrawn', lang) :
                                t('tabRaw', lang)}
                      {tabCounts[tab] > 0 && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          tab === 'defaulted' ? 'bg-rose-100 text-rose-700' :
                          tab === 'paid' ? 'bg-cyan-100 text-cyan-700' :
                          tab === 'renewals' ? 'bg-indigo-100 text-indigo-700' :
                          tab === 'withdrawn' ? 'bg-amber-100 text-amber-700' :
                          tab === 'all' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{tabCounts[tab]}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-0 overflow-x-auto overflow-y-auto max-h-[600px] relative">
                  <table className="hidden md:table w-full text-left whitespace-nowrap text-sm">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-[0_1px_0_#E2E8F0]">
                      <tr>
                        <th className="px-4 py-3 text-left">{t('customerId', lang)}</th>
                        <th className="px-4 py-3 text-left">{t('name', lang)}</th>
                        <th className="px-4 py-3 text-right">{t('principal', lang)}</th>
                        <th className="px-4 py-3 text-right">{t('interestRate', lang)}</th>
                        <th className="px-4 py-3 text-center">{t('issueDate', lang)}</th>
                        <th className="px-4 py-3 text-center">{t('dueDate', lang)}</th>
                        <th className="px-4 py-3 text-left">{t('status', lang)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100" ref={tableRef}>
                      {filteredLoans.map((l) => (
                        <tr key={l.id} onClick={() => setSelectedLoan(l)} className={`cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors ${l.isOverdue ? 'bg-rose-50/30' : ''}`}>
                          <td className="px-4 py-3 font-mono text-slate-400 text-xs">{l.id}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {l.name}
                            {l.isOverdue && <span className="ml-2 text-[10px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-200">{l.daysLate}d overdue</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-sm">{formatNumber(l.principal)}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{l.interestRate}%</td>
                          <td className="px-4 py-3 text-center text-slate-500">{l.borrowDate}</td>
                          <td className={`px-4 py-3 text-center text-sm font-medium ${l.isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>{l.dueDate}</td>
                          <td className="px-4 py-3">{renderStatusBadge(l.status)}</td>
                        </tr>
                      ))}
                      {filteredLoans.length === 0 && (
                        <tr><td colSpan={7} className="py-16 text-center text-slate-400">
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="font-bold text-sm">{lang === 'th' ? 'ไม่พบรายการ' : 'No results found'}</p>
                          {searchQuery && <p className="text-xs mt-1">"{searchQuery}"</p>}
                        </td></tr>
                      )}
                    </tbody>
                  </table>

                  <div className="md:hidden" ref={tableRef as any}>
                    {filteredLoans.map((l) => {
                      const stripeClass = l.isScam ? 'border-l-[3px] border-rose-500'
                        : l.isPaid ? 'border-l-[3px] border-cyan-400'
                        : l.isRenewed ? 'border-l-[3px] border-indigo-500'
                        : l.isWithdrawn ? 'border-l-[3px] border-amber-400'
                        : l.isOverdue ? 'border-l-[3px] border-red-500'
                        : 'border-l-[3px] border-emerald-500';
                      const avatarBg = l.isScam ? 'bg-rose-100 text-rose-700'
                        : l.isPaid ? 'bg-cyan-100 text-cyan-700'
                        : l.isRenewed ? 'bg-indigo-100 text-indigo-700'
                        : l.isOverdue ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700';
                      return (
                        <div
                          key={l.id}
                          onClick={() => setSelectedLoan(l)}
                          style={{ touchAction: 'manipulation' }}
                          className={`flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50 cursor-pointer ${stripeClass} ${l.isOverdue ? 'bg-rose-50/20' : ''}`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm ${avatarBg}`}>
                            {l.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 text-sm truncate">{l.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-medium">{l.id}</span>
                              <span className="text-slate-300">·</span>
                              {l.isOverdue
                                ? <span className="text-[10px] font-black text-rose-500">{l.daysLate} {t('daysOverdue', lang)}</span>
                                : <span className="text-[10px] text-slate-400">{t('due', lang)} {l.dueDate}</span>
                              }
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-black text-slate-900 text-sm">{formatCurrency(l.totalExpected)}</div>
                            {renderStatusBadge(l.status)}
                          </div>
                        </div>
                      );
                    })}
                    {filteredLoans.length === 0 && (
                      <div className="py-16 text-center text-slate-400">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-sm">{lang === 'th' ? 'ไม่พบรายการ' : 'No results found'}</p>
                        {searchQuery && <p className="text-xs mt-1 text-slate-400">"{searchQuery}"</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Nav — 5-tab with center FAB */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-40">
        <div className="bg-slate-900/95 backdrop-blur-xl border-t border-white/10 flex items-center shadow-[0_-8px_30px_rgba(0,0,0,0.3)]">
          {/* Home */}
          <button style={{ touchAction: 'manipulation' }} onClick={() => setActiveMobileTab('dashboard')} className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeMobileTab === 'dashboard' ? 'text-emerald-400' : 'text-white/40'}`}>
            <Home className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">{t('navDashboard', lang)}</span>
          </button>
          {/* Loans */}
          <button style={{ touchAction: 'manipulation' }} onClick={() => setActiveMobileTab('loans')} className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors relative ${activeMobileTab === 'loans' ? 'text-emerald-400' : 'text-white/40'}`}>
            <List className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">{t('navLoans', lang)}</span>
            {overdueLoans.length > 0 && <span className="absolute top-2 right-[calc(50%-10px)] w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{overdueLoans.length}</span>}
          </button>
          {/* FAB */}
          <div className="flex-1 flex justify-center items-center relative py-2">
            <button
              style={{ touchAction: 'manipulation' }}
              onClick={() => setShowFabMenu(v => !v)}
              className={`w-14 h-14 rounded-full flex items-center justify-center -mt-6 border-4 border-slate-900 shadow-xl shadow-emerald-900/40 active:scale-95 transition-all ${showFabMenu ? 'rotate-45 bg-slate-600' : 'bg-gradient-to-br from-emerald-400 to-emerald-600'}`}
            >
              <Plus className="w-6 h-6 text-white stroke-[3]" />
            </button>
          </div>
          {/* Analytics */}
          <button style={{ touchAction: 'manipulation' }} onClick={() => setActiveMobileTab('analytics')} className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeMobileTab === 'analytics' ? 'text-emerald-400' : 'text-white/40'}`}>
            <BarChart2 className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">{t('navAnalytics', lang)}</span>
          </button>
          {/* Notifications */}
          <button style={{ touchAction: 'manipulation' }} onClick={() => setShowNotifModal(true)} className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors relative ${isSubscribed ? 'text-emerald-400' : 'text-white/40'}`}>
            {isSubscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            <span className="text-[9px] font-bold uppercase tracking-wide">{lang === 'th' ? 'แจ้งเตือน' : 'Alerts'}</span>
          </button>
        </div>
        <div className="bg-slate-900/95 pb-safe" />
      </div>

      <AnimatePresence>
        {selectedLoan && (
          <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedLoan(null)}
          >
            <motion.div
              className="bg-white w-full md:rounded-2xl md:max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] rounded-t-3xl"
              initial={{ translateY: '100%' }}
              animate={{ translateY: 0 }}
              exit={{ translateY: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >

              <div className={`flex justify-between items-start px-5 py-4 border-b border-slate-100 ${
                selectedLoan.isScam ? 'bg-gradient-to-r from-rose-50 to-white'
                : selectedLoan.isOverdue ? 'bg-gradient-to-r from-red-50 to-white'
                : selectedLoan.isPaid ? 'bg-gradient-to-r from-cyan-50 to-white'
                : selectedLoan.isRenewed ? 'bg-gradient-to-r from-indigo-50 to-white'
                : 'bg-gradient-to-r from-emerald-50 to-white'
              }`}>
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 flex-wrap">
                    {selectedLoan.name}
                    <button
                      onClick={() => setIsEditingLoan(!isEditingLoan)}
                      className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors ${
                        isEditingLoan ? 'bg-indigo-100 text-indigo-700' : 'bg-white/80 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {isEditingLoan ? t('cancelEdit', lang) : t('editDetails', lang)}
                    </button>
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">ID: {selectedLoan.id}</span>
                    {selectedLoan.isScam ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase">💀 Defaulted</span>
                    ) : selectedLoan.isWithdrawn ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">Payout</span>
                    ) : selectedLoan.isPaid ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-bold uppercase">✓ Paid</span>
                    ) : selectedLoan.isRenewed ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase">Renewed</span>
                    ) : selectedLoan.isOverdue ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold uppercase">⚠ {selectedLoan.daysLate}d overdue</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">Active</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLoan(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors flex-shrink-0 ml-2"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('financialDetails', lang)}</h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {isEditingLoan ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">{t('principal', lang)}</label>
                          <input
                            type="number"
                            value={editLoanForm.principal}
                            onChange={e => setEditLoanForm({ ...editLoanForm, principal: e.target.value })}
                            className="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-1.5"
                          />
                          <div className="flex flex-wrap gap-1">
                            {[10, 50, 100, 500, 1000].map(amt => (
                              <button key={amt} type="button"
                                onClick={() => setEditLoanForm(f => ({ ...f, principal: String(Math.max(0, parseFloat(f.principal || '0') + amt)) }))}
                                className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-100 transition-colors">
                                +{amt}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">{t('interestRateLabel', lang)}</label>
                          <input
                            type="number"
                            value={editLoanForm.interestRate}
                            onChange={e => setEditLoanForm({ ...editLoanForm, interestRate: Number(e.target.value) })}
                            className="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
                          <span className="text-slate-700 font-bold">{t('newExpected', lang)}</span>
                          <span className="font-black text-xl text-indigo-600">
                            {formatCurrency(parseFloat(editLoanForm.principal) + ((parseFloat(editLoanForm.principal) * editLoanForm.interestRate) / 100))}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-500 text-sm">{t('principal', lang)}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedLoan.principal)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-500 text-sm">{t('interestRate', lang)}</span>
                          <span className="font-semibold text-slate-800">{selectedLoan.interestRate}%</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-500 text-sm">{t('expectedInterest', lang)}</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(selectedLoan.expectedInterest)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                          <span className="text-slate-500 text-sm">{t('penaltyFee', lang)}</span>
                          <span className="font-semibold text-amber-600">+{formatCurrency(selectedLoan.penalty)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-700 font-bold">{t('totalExpected', lang)}</span>
                          <span className="font-black text-xl text-slate-900">{formatCurrency(selectedLoan.totalExpected)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('paymentsAndDates', lang)}</h3>
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-emerald-700 text-sm">{t('totalPaid', lang)}</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(selectedLoan.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-emerald-600/80 pl-2 border-l-2 border-emerald-200 ml-1">
                      <span>{t('principalPaid', lang)}</span>
                      <span>{formatCurrency(selectedLoan.paidPrincipal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-emerald-600/80 pl-2 border-l-2 border-emerald-200 ml-1 mt-1">
                      <span>{t('interestPaid', lang)}</span>
                      <span>{formatCurrency(selectedLoan.paidInterest)}</span>
                    </div>
                  </div>

                  {selectedLoan.historicalRenewalCount > 0 && (
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-indigo-800 text-sm font-semibold">{t('renewalHistory', lang)}</span>
                        <span className="bg-indigo-200 text-indigo-800 text-xs px-2 py-0.5 rounded-full font-bold">{selectedLoan.historicalRenewalCount} {t('times', lang)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-indigo-600">{t('totalInterestAccumulated', lang)}</span>
                        <span className="font-black text-indigo-700">{formatCurrency(selectedLoan.historicalRenewalInterest)}</span>
                      </div>
                    </div>
                  )}

                  {selectedLoan.penaltyHistory && selectedLoan.penaltyHistory.length > 0 && (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-amber-800 text-sm font-semibold">{t('penaltyHistory', lang)}</span>
                        <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                          {formatCurrency(selectedLoan.penaltyHistory.reduce((sum, p) => sum + p.amount, 0))}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {selectedLoan.penaltyHistory.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs text-amber-700">
                            <span>{t('round', lang)} {i + 1} · {p.date}</span>
                            <span className="font-bold">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {isEditingLoan ? (
                        <>
                          <div className="text-xs font-bold text-slate-500 mb-1">{t('issueDate', lang)}</div>
                          <DatePicker
                            selected={editLoanForm.borrowDate}
                            onChange={(date: Date | null) => {
                              if (!date) return;
                              const dDate = new Date(date.getTime() + editLoanForm.daysBorrowed * 86400000);
                              setEditLoanForm(f => ({ ...f, borrowDate: date, dueDate: dDate }));
                            }}
                            dateFormat="dd/MM/yyyy"
                            className="w-full border border-slate-300 rounded p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white"
                          />
                        </>
                      ) : (
                        <>
                          <div className="text-xs text-slate-500 mb-1">{t('issueDate', lang)}</div>
                          <div className="font-semibold text-slate-800">{selectedLoan.borrowDate}</div>
                        </>
                      )}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {isEditingLoan ? (
                        <>
                          <div className="text-xs font-bold text-slate-500 mb-1">{t('dueDateLabel', lang)}</div>
                          <DatePicker
                            selected={editLoanForm.dueDate}
                            onChange={handleEditDueDateChange}
                            dateFormat="dd/MM/yyyy"
                            className="w-full border border-slate-300 rounded p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white"
                          />
                        </>
                      ) : (
                        <>
                          <div className="text-xs text-slate-500 mb-1">{t('dueDateLabel', lang)}</div>
                          <div className={`font-semibold ${selectedLoan.isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                            {selectedLoan.dueDate}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white">
                {isEditingLoan ? (
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSyncing}
                    className="w-full py-3.5 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                  >
                    {isSyncing ? t('saving', lang) : t('saveChanges', lang)}
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-500 whitespace-nowrap">{t('actionDate', lang)}</label>
                      <DatePicker
                        selected={actionDate}
                        onChange={(date) => date && setActionDate(date)}
                        dateFormat="dd/MM/yyyy"
                        className="border border-slate-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer bg-slate-50 w-32 font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-500 whitespace-nowrap">{lang === 'th' ? 'ค่าปรับ' : 'Penalty'}</label>
                      <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-bold">
                        <button
                          onClick={() => setHasPenalty(false)}
                          className={`px-3 py-1.5 transition-colors ${!hasPenalty ? 'bg-slate-700 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                        >{lang === 'th' ? 'ไม่มี' : 'None'}</button>
                        <button
                          onClick={() => setHasPenalty(true)}
                          className={`px-3 py-1.5 transition-colors ${hasPenalty ? 'bg-amber-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                        >{lang === 'th' ? 'มี' : 'Yes'}</button>
                      </div>
                      {hasPenalty && (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number"
                            value={penaltyAmount}
                            onChange={e => setPenaltyAmount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="border border-amber-300 rounded-xl px-3 py-1.5 text-sm w-24 text-center font-black text-amber-700 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <span className="text-xs font-bold text-amber-600">฿</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleUpdateStatus('ชำระแล้ว')}
                        className="py-3.5 font-bold rounded-xl text-white text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                      >
                        <CheckCircle2 className="w-4 h-4" /> {t('markPaid', lang)}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('ต่อดอก')}
                        className="py-3.5 font-bold rounded-xl text-white text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                      >
                        <Activity className="w-4 h-4" /> {t('renew', lang)}
                      </button>
                      <button
                        onClick={() => setShowConfirmDefault(true)}
                        className="py-3.5 font-bold rounded-xl text-white text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
                      >
                        <UserX className="w-4 h-4" /> {t('default', lang)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showExpandedTrend && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lg:p-8 bg-slate-900/70 backdrop-blur-sm"
          onClick={() => { setShowExpandedTrend(false); setInsightDate(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] lg:h-[85vh] overflow-hidden flex flex-col animate-[slideIn_0.2s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-slate-200 bg-white">
              <div>
                <h2 className="text-xl lg:text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Activity className="w-6 h-6 lg:w-7 lg:h-7 text-indigo-600" /> {t('advancedCashflow', lang)}
                </h2>
                <p className="text-sm text-slate-500 mt-1 font-medium">{t('cashflow30History', lang)}</p>
              </div>
              <button onClick={() => { setShowExpandedTrend(false); setInsightDate(null); }} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"><X size={24} /></button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50">
              <div className="w-full lg:w-2/3 p-6 flex flex-col bg-white border-r border-slate-200 shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-10">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('trend30day', lang)}</h3>
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full font-bold border border-indigo-100 animate-pulse">{t('clickBarToViewDetails', lang)}</span>
                </div>
                <div className="flex-1 w-full min-h-[250px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={trendData30}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={(e: any) => {
                        if (e && e.activeLabel) {
                          setInsightDate(labelToFullDate.get(e.activeLabel) ?? e.activeLabel);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="Expected" barSize={16} fill="#94A3B8" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="Received" stroke="#10B981" strokeWidth={4} dot={{ r: 4, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }} />
                      <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="w-full lg:w-1/3 p-0 flex flex-col overflow-y-auto">
                {!insightDate ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-60">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-4">
                      <Activity className="w-10 h-10" />
                    </div>
                    <p className="font-extrabold text-lg text-slate-700">{t('noDateSelected', lang)}</p>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">{t('selectDateOnGraph', lang)}</p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                      <div className="bg-indigo-600 text-white p-2 rounded-lg"><CalendarClock className="w-5 h-5" /></div>
                      <div>
                        <h2 className="text-xl font-black text-slate-800">{insightDate}</h2>
                        <p className="text-xs font-bold text-indigo-600 uppercase">{t('dailyInsightReport', lang)}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('expectedInterestDue', lang)}</h3>
                      <div className="space-y-2">
                        {data.loans.filter(l => l.dueDate === insightDate).length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2 px-1">{t('noExpectedForDate', lang)}</p>
                        ) : data.loans.filter(l => l.dueDate === insightDate).map(l => (
                          <div key={'exp-' + l.id} className="flex justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{l.name} <span className="text-xs text-slate-400 font-normal">({l.id})</span></div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{t('principal', lang)}: {formatCurrency(l.principal)}</div>
                            </div>
                            <div className="flex flex-col items-end justify-center">
                              <span className="font-black text-slate-700">{formatCurrency(l.expectedInterest)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('actualPaymentsReceived', lang)}</h3>
                      <div className="space-y-2">
                        {data.loans.filter(l => l.actualDate === insightDate && (l.isPaid || l.isRenewed)).length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2 px-1">{t('noPaymentsForDate', lang)}</p>
                        ) : data.loans.filter(l => l.actualDate === insightDate && (l.isPaid || l.isRenewed)).map(l => (
                          <div key={'act-' + l.id} className="flex justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200 shadow-sm">
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{l.name} <span className="text-xs text-slate-400 font-normal">({l.id})</span></div>
                              <div className="mt-1">{renderStatusBadge(l.status)}</div>
                            </div>
                            <div className="flex flex-col items-end justify-center gap-0.5">
                              <span className="font-black text-emerald-700">{formatCurrency(l.paidInterest)}</span>
                              <span className="text-[10px] text-emerald-600">{t('principalPaid', lang)}: {formatCurrency(l.paidPrincipal)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal — slide-up sheet on mobile */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowWithdrawModal(false)}>
          <div className="bg-white w-full md:max-w-md md:rounded-2xl shadow-2xl overflow-hidden rounded-t-3xl animate-sheet-up md:animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>
                  <Wallet className="w-4.5 h-4.5 text-white" style={{ width: '18px', height: '18px' }} />
                </div>
                <h3 className="text-lg font-black text-slate-800">{t('newPayout', lang)}</h3>
              </div>
              <button onClick={() => setShowWithdrawModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('payoutAmount', lang)}</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={withdrawForm.principal}
                  onChange={e => setWithdrawForm({ ...withdrawForm, principal: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="ระบุจำนวนเงิน"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[10, 50, 100, 500, 1000].map(amt => (
                    <button
                      key={amt} type="button"
                      onClick={() => setWithdrawForm(f => ({ ...f, principal: String(Math.max(0, parseFloat(f.principal || '0') + amt)) }))}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100"
                    >
                      +{formatNumber(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('withdrawalDate', lang)}</label>
                <DatePicker
                  selected={withdrawForm.date}
                  onChange={(date: Date | null) => setWithdrawForm({ ...withdrawForm, date: date ?? new Date() })}
                  dateFormat="dd/MM/yyyy"
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('withdrawalName', lang)}</label>
                <input
                  type="text"
                  value={withdrawForm.name}
                  onChange={e => setWithdrawForm({ ...withdrawForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Withdrawal (default)"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 mt-2 px-0 pb-0 flex justify-end gap-3">
                <button type="button" onClick={() => setShowWithdrawModal(false)} className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors text-sm">{t('cancel', lang)}</button>
                <button type="submit" disabled={isSyncing} className="px-5 py-2.5 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 text-sm" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>
                  {isSyncing ? t('saving', lang) : t('confirmPayout', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Loan Modal — slide-up sheet on mobile */}
      {showNewLoanModal && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowNewLoanModal(false)}>
          <div className="bg-white w-full md:max-w-md md:rounded-2xl shadow-2xl overflow-hidden rounded-t-3xl animate-sheet-up md:animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                  <Activity className="w-4.5 h-4.5 text-white" style={{ width: '18px', height: '18px' }} />
                </div>
                <h3 className="text-lg font-black text-slate-800">{t('issueNewLoan', lang)}</h3>
              </div>
              <button onClick={() => setShowNewLoanModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateNewLoan} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('borrowerName', lang)}</label>
                <input
                  type="text"
                  required
                  value={newLoanForm.name}
                  onChange={e => setNewLoanForm({ ...newLoanForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('principalAmount', lang)}</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newLoanForm.principal}
                  onChange={e => setNewLoanForm({ ...newLoanForm, principal: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                  placeholder="฿"
                />
                <div className="flex flex-wrap gap-2">
                  {[10, 50, 100, 500, 1000].map(amt => (
                    <button
                      key={amt} type="button"
                      onClick={() => setNewLoanForm(f => ({ ...f, principal: String(Math.max(0, parseFloat(f.principal || '0') + amt)) }))}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                    >
                      +{formatNumber(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 relative">
                <div className="flex flex-col relative z-20">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('borrowDate', lang)}</label>
                  <DatePicker
                    selected={newLoanForm.borrowDate}
                    onChange={handleBorrowDateChange}
                    dateFormat="dd/MM/yyyy"
                    className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white"
                  />
                </div>
                <div className="flex flex-col relative z-20">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('dueDateLabel', lang)}</label>
                  <DatePicker
                    selected={newLoanForm.dueDate}
                    onChange={handleDueDateChange}
                    dateFormat="dd/MM/yyyy"
                    className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('daysBorrowed', lang)}</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDaysChange(newLoanForm.daysBorrowed - 1)}
                      disabled={newLoanForm.daysBorrowed <= 1}
                      className="w-9 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed bg-white hover:bg-slate-50 transition-colors flex-shrink-0"
                    >−</button>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newLoanForm.daysBorrowed}
                      onChange={e => handleDaysChange(Number(e.target.value))}
                      className="flex-1 border border-slate-200 rounded-lg p-3 text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleDaysChange(newLoanForm.daysBorrowed + 1)}
                      className="w-9 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg bg-white hover:bg-slate-50 transition-colors flex-shrink-0"
                    >+</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('interestRateLabel', lang)}</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newLoanForm.interestRate}
                    onChange={e => setNewLoanForm({ ...newLoanForm, interestRate: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-2 px-0 pb-0 flex justify-end gap-3">
                <button type="button" onClick={() => setShowNewLoanModal(false)} className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors text-sm">{t('cancel', lang)}</button>
                <button type="submit" disabled={isSyncing} className="px-5 py-2.5 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 text-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                  {isSyncing ? t('saving', lang) : t('addLoan', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNotifModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowNotifModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-slate-800">{t('notifTitle', lang)}</h2>
              <button onClick={() => setShowNotifModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className={`p-4 rounded-xl border text-center font-bold text-sm ${isSubscribed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : notifPermission === 'denied' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                {isSubscribed ? t('notifEnabled', lang) : notifPermission === 'denied' ? t('notifBlocked', lang) : t('notifDisabled', lang)}
                <p className="font-normal text-xs mt-1 opacity-80">
                  {isSubscribed ? t('notifEnabledDesc', lang) : notifPermission === 'denied' ? t('notifBlockedDesc', lang) : t('notifDisabledDesc', lang)}
                </p>
              </div>
              {isSubscribed && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('testNotif', lang)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleTestNotif('morning')} disabled={isSendingTestNotif} className="py-2.5 text-sm font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50">{t('testMorning', lang)}</button>
                    <button onClick={() => handleTestNotif('afternoon')} disabled={isSendingTestNotif} className="py-2.5 text-sm font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50">{t('testAfternoon', lang)}</button>
                  </div>
                </div>
              )}
              <div className="pt-2 flex flex-col gap-2">
                {!isSubscribed && notifPermission !== 'denied' && (
                  <button onClick={handleEnableNotif} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm">{t('enableNotif', lang)}</button>
                )}
                {isSubscribed && (
                  <button onClick={handleDisableNotif} className="w-full py-3 bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-xl hover:bg-rose-100 transition-colors text-sm">{t('disableNotif', lang)}</button>
                )}
                <button onClick={() => setShowNotifModal(false)} className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm">{t('cancel', lang)}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB Menu Overlay — mobile only */}
      <AnimatePresence>
        {showFabMenu && (
          <motion.div
            className="fixed inset-0 z-[55] md:hidden flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFabMenu(false)}
          >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div
              className="relative px-6 pb-28 flex flex-col gap-3"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => { setShowFabMenu(false); setShowNewLoanModal(true); }}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
              >
                <Activity className="w-5 h-5" /> {t('newLoan', lang)}
              </button>
              <button
                onClick={() => { setShowFabMenu(false); setShowWithdrawModal(true); }}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
              >
                <Wallet className="w-5 h-5" /> {t('withdraw', lang)}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Default Dialog */}
      <AnimatePresence>
        {showConfirmDefault && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmDefault(false)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UserX className="w-7 h-7 text-rose-600" />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-1">{lang === 'th' ? 'ยืนยันการบันทึก "โดนบิด"?' : 'Confirm Default?'}</h3>
                <p className="text-sm text-slate-500 mb-6">{lang === 'th' ? 'รายการนี้จะถูกบันทึกว่าโดนบิด และไม่สามารถยกเลิกได้ง่าย ๆ' : 'This loan will be marked as defaulted. This is hard to undo.'}</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowConfirmDefault(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                    {t('cancel', lang)}
                  </button>
                  <button
                    onClick={() => { setShowConfirmDefault(false); handleUpdateStatus('โดนบิด'); }}
                    className="flex-1 py-3 rounded-xl text-white font-bold text-sm active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
                  >
                    {t('default', lang)}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profit Detail Modal */}
      {showProfitModal && data && (() => {
        const totalFutureProfit = s.paidInterest + s.unpaidInterest - s.scamPrincipal - s.withdrawn;
        const rows = [
          { label: lang === 'th' ? 'ดอกที่ได้รับแล้ว' : 'Interest Received', value: s.paidInterest, color: 'emerald', sign: '+' },
          { label: lang === 'th' ? 'หักโดนบิด' : 'Deduct Defaults', value: -s.scamPrincipal, color: 'rose', sign: '-' },
          { label: lang === 'th' ? 'หักเบิก' : 'Deduct Withdrawals', value: -s.withdrawn, color: 'amber', sign: '-' },
        ];
        return (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProfitModal(false)}>
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'th' ? 'รายละเอียดกำไร' : 'Profit Breakdown'}</div>
                  <div className={`text-2xl font-black mt-0.5 ${s.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(s.netProfit)}</div>
                </div>
                <button onClick={() => setShowProfitModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"><X size={20} /></button>
              </div>
              <div className="p-5 space-y-3">
                {rows.map(r => (
                  <div key={r.label} className={`flex items-center justify-between px-3 py-2.5 rounded-xl bg-${r.color}-50`}>
                    <span className={`text-xs font-bold text-${r.color}-700`}>{r.label}</span>
                    <span className={`text-sm font-black text-${r.color}-700`}>{r.sign}{formatCurrency(Math.abs(r.value))}</span>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between px-3">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide">{lang === 'th' ? 'กำไรสุทธิ' : 'Net Profit'}</span>
                  <span className={`text-base font-black ${s.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(s.netProfit)}</span>
                </div>

                <div className="bg-indigo-50 rounded-xl p-3 mt-1">
                  <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">{lang === 'th' ? 'ดอกรอรับจากพอร์ตปัจจุบัน' : 'Unrealized Interest'}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-indigo-600">{lang === 'th' ? 'ดอกที่ยังไม่ถึงกำหนด' : 'Pending interest'}</span>
                    <span className="text-sm font-black text-indigo-700">+{formatCurrency(s.unpaidInterest)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-indigo-100">
                    <span className="text-xs font-bold text-indigo-700">{lang === 'th' ? 'กำไรรวมถ้าเก็บครบ' : 'Total if all collected'}</span>
                    <span className={`text-sm font-black ${totalFutureProfit >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatCurrency(totalFutureProfit)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-black text-slate-800">{s.profitPct.toFixed(1)}%</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{lang === 'th' ? 'yield ต่อทุน' : 'Yield on Capital'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-black text-slate-800">{formatCurrency(s.paidInterest)}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{lang === 'th' ? 'ดอกสะสม' : 'Total Interest'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
          <div className={`px-6 py-3 rounded-xl shadow-2xl text-white font-bold flex items-center gap-3 ${toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {toastMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {toastMessage.text}
          </div>
        </div>
      )}
    </div>
  );
}
