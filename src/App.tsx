import React, { useEffect, useState, useCallback } from 'react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fetchAppData, AppData, LoanRecord, updateLoanStatus, createNewLoan, editExistingLoan } from './services/dataService';
import { formatCurrency, formatNumber, parseThaiDate } from './lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, CalendarClock, Activity, FileSpreadsheet, List, X, CheckCircle2, UserX, Wallet, RefreshCcw, LineChart, Bell, BellOff, Home, BarChart2, Languages, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush, getNotificationPermission, sendTestNotification } from './services/pushService';
import { t, Lang } from './lib/i18n';

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
  const [showPortfolioProgressModal, setShowPortfolioProgressModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'th');
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'loans' | 'analytics'>('dashboard');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const tabs: ('dashboard' | 'analytics' | 'loans')[] = ['dashboard', 'analytics', 'loans'];
      const currentIndex = tabs.indexOf(activeMobileTab);

      if (isLeftSwipe && currentIndex < tabs.length - 1) {
        setActiveMobileTab(tabs[currentIndex + 1]);
      }
      if (isRightSwipe && currentIndex > 0) {
        setActiveMobileTab(tabs[currentIndex - 1]);
      }
    }
  };

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
    dueDate: new Date(),
    daysBorrowed: 7,
    interestRate: 35
  });

  // Reset states when selected loan changes
  useEffect(() => {
    setIsEditingLoan(false);
    setActionDate(new Date());
    if (selectedLoan) {
      const parts = selectedLoan.dueDate.split('/');
      const dDate = parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])) : new Date();
      setEditLoanForm({
        principal: selectedLoan.principal.toString(),
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
    if (!date || !selectedLoan) return;
    const parts = selectedLoan.borrowDate.split('/');
    if (parts.length !== 3) return;
    const bDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const diffTime = date.getTime() - bDate.getTime();
    const days = Math.max(1, Math.ceil(diffTime / 86400000));
    setEditLoanForm(f => ({ ...f, dueDate: date, daysBorrowed: days, interestRate: days * 5 }));
  };

  const handleEditDaysChange = (val: number) => {
    if (!selectedLoan) return;
    const days = Math.max(1, val);
    const parts = selectedLoan.borrowDate.split('/');
    if (parts.length !== 3) return;
    const bDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const dDate = new Date(bDate.getTime() + days * 86400000);
    setEditLoanForm(f => ({ ...f, daysBorrowed: days, dueDate: dDate, interestRate: days * 5 }));
  };

  const formatToThaiStr = (dateObj: Date) => {
    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
  };

  const [dueListRef] = useAutoAnimate<HTMLDivElement>();
  const [overdueListRef] = useAutoAnimate<HTMLDivElement>();
  const [tableRef] = useAutoAnimate<HTMLTableSectionElement>();

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

    const formatToThaiStr = (dateObj: Date) => {
      return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
    };

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

    // 3. ส่งข้อมูลไปอัปเดตที่ Google Sheets เบื้องหลัง
    const success = await updateLoanStatus(currentLoan.id, action, formattedActionDate);

    // ถ้าพลาด แจ้งเตือน และแอบโหลดข้อมูลใหม่
    if (!success) {
      showToast(`เกิดข้อผิดพลาดในการอัปเดตข้อมูลไป Google Sheets`, 'error');
      setIsSyncing(false);
    } else {
      setTimeout(() => {
        loadData(true);
      }, 1500); // ดีเลย์ 1.5 วิ ให้ sheet คำนวณเสร็จ
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedLoan || !data) return;

    setIsSyncing(true);
    const currentLoan = { ...selectedLoan };

    try {
      const success = await editExistingLoan(currentLoan.id, {
        principal: parseFloat(editLoanForm.principal),
        dueDate: formatToThaiStr(editLoanForm.dueDate),
        daysBorrowed: editLoanForm.daysBorrowed,
        interestRate: editLoanForm.interestRate
      });

      if (success) {
        showToast(`Loan details updated`, 'success');
        setIsEditingLoan(false);

        // Optimistic UI update for edits
        const updatedLoans = [...data.loans];
        const loanIndex = updatedLoans.findIndex(l => l.id === currentLoan.id);
        if (loanIndex > -1) {
          updatedLoans[loanIndex] = {
            ...updatedLoans[loanIndex],
            principal: parseFloat(editLoanForm.principal),
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
      showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 'error');
    } finally {
      setIsSyncing(false);
      setTimeout(() => loadData(true), 2500);
    }
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

    // Initialize Service Worker & check notification status
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

  // Categorize loans
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueTodayLoans = data.loans.filter(l => {
    if (l.isPaid || l.isScam || l.isRenewed || l.isWithdrawn) return false;
    const parsed = parseThaiDate(l.dueDate);
    return parsed && parsed.getTime() === today.getTime();
  });

  const overdueLoans = data.loans.filter(l => l.isOverdue && !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn);
  const scamLoans = data.loans.filter(l => l.isScam);
  const renewedLoans = data.loans.filter(l => l.isRenewed);
  const activeLoans = data.loans.filter(l => !l.isPaid && !l.isScam && !l.isOverdue && !l.isRenewed && !l.isWithdrawn);
  const paidLoans = data.loans.filter(l => l.isPaid);
  const withdrawnLoans = data.loans.filter(l => l.isWithdrawn);

  // Portfolio Progress Data for Gauge Chart
  const progressData = [
    { name: 'Collected', value: s.totalPaid, color: '#10B981' },
    { name: 'Remaining', value: s.totalUnpaid, color: '#E2E8F0' }
  ];
  const progressPct = s.totalExpected > 0 ? ((s.totalPaid / s.totalExpected) * 100).toFixed(1) : '0.0';

  // Derive Cashflow Trend (Interest Expected vs Received)
  const dateMap: Record<string, { expected: number, actual: number }> = {};
  const allDates = new Set<string>();

  data.loans.forEach(l => {
    if (l.dueDate && parseThaiDate(l.dueDate)) {
      const d = l.dueDate;
      allDates.add(d);
      if (!dateMap[d]) dateMap[d] = { expected: 0, actual: 0 };
      dateMap[d].expected += l.expectedInterest;
    }

    if (l.actualDate && parseThaiDate(l.actualDate)) {
      const d = l.actualDate;
      allDates.add(d);
      if (!dateMap[d]) dateMap[d] = { expected: 0, actual: 0 };
      dateMap[d].actual += l.paidInterest;
    }
  });

  const sortedDates = Array.from(allDates).sort((a, b) => parseThaiDate(a)!.getTime() - parseThaiDate(b)!.getTime());
  const trendData14 = sortedDates.slice(-14).map(date => ({ date: date.substring(0, 5), Expected: dateMap[date].expected, Received: dateMap[date].actual }));
  const trendData30 = sortedDates.slice(-30).map(date => ({ date: date.substring(0, 5), Expected: dateMap[date].expected, Received: dateMap[date].actual }));

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

  const MetricCard = ({ label, value, sub, subColor = 'emerald', icon: Icon, iconBg }: { label: string; value: string; sub: React.ReactNode; subColor?: string; icon: React.ElementType; iconBg: string }) => (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm card-lift overflow-hidden relative">
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
        sub={<><TrendingUp className="w-3 h-3" /> {s.profitPct}% {t('margin', lang)}</>}
        subColor="emerald"
        icon={LineChart}
        iconBg="bg-indigo-100 text-indigo-600"
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
    <div
      className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-28 md:pb-8"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
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
        {/* Active tab indicator bar */}
        <div className="flex border-t border-white/5">
          {(['dashboard', 'analytics', 'loans'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveMobileTab(tab)}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                activeMobileTab === tab ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/30'
              }`}
            >
              {tab === 'dashboard' ? t('navDashboard', lang) : tab === 'analytics' ? t('navAnalytics', lang) : t('navLoans', lang)}
            </button>
          ))}
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

        {/* Mobile: section visibility by active tab */}
        {/* Dashboard Tab Content: Metrics & Alerts */}
        <div className={activeMobileTab === 'dashboard' ? 'block' : 'hidden md:block'}>
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
                        className="flex justify-between items-center px-4 py-3 hover:bg-amber-50/50 active:bg-amber-50 transition-colors cursor-pointer border-l-[3px] border-amber-400"
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
                        className="flex justify-between items-center px-4 py-3 hover:bg-rose-50/50 active:bg-rose-50 transition-colors cursor-pointer border-l-[3px] border-rose-500"
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
        </div>



        {/* Analytics Tab Content: Charts & Insights */}
        {/* Analytics Tab Content: Charts & Insights (Desktop) / Portfolio Progress (Mobile) */}
        <div className={activeMobileTab === 'analytics' ? 'block' : 'hidden md:block'}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-black text-slate-800">{t('portfolioAnalytics', lang)}</h2>
            {/* Mobile-only date indicator */}
            <span className="md:hidden text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider border border-slate-200">
              {new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* Desktop Only: Charts Row */}
          <div className="hidden md:grid md:grid-cols-2 gap-6 mb-8">
            <div
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center cursor-pointer group hover:border-emerald-300 hover:shadow-md transition-all relative overflow-hidden"
              onClick={() => setShowPortfolioProgressModal(true)}
            >
              <div className="w-full flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('portfolioProgress', lang)}</h3>
                <span className="text-xs text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full font-bold border border-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity">{t('clickForInsights', lang)}</span>
              </div>
              <div className="h-[180px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={progressData} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={80} outerRadius={110} dataKey="value" stroke="none">
                      {progressData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(val: number) => [formatCurrency(val), 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-0 left-0 right-0 text-center flex flex-col items-center justify-end pb-2">
                  <span className="text-4xl font-black text-slate-800">{progressPct}%</span>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{t('collected', lang)}</span>
                </div>
              </div>
            </div>

            <div
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col cursor-pointer group hover:border-indigo-300 hover:shadow-md transition-all"
              onClick={() => setShowExpandedTrend(true)}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('cashflowTrend', lang)}</h3>
                <span className="text-xs text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full font-bold border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">{t('clickToExpand', lang)}</span>
              </div>
              <div className="h-[180px] w-full">
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
          </div>

          {/* Mobile and Detailed Insights (Desktop) */}
          <div className="space-y-4">
            {/* Summary Cards */}
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

            {/* Principal Breakdown Card */}
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

            {/* Interest Breakdown Card */}
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
          </div>
        </div>

        {/* Loans Tab Content: Data Management Table */}
        <div className={activeMobileTab === 'loans' ? 'block' : 'hidden md:block'}>
          <h2 className="text-base font-bold mb-3 text-slate-800">{t('dataManagement', lang)}</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
              {(['all', 'renewals', 'paid', 'defaulted', 'withdrawn', 'raw'] as const).map(tab => (
                <button
                  key={tab}
                  className={`px-4 py-3 text-xs font-semibold capitalize border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500'}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'all' ? t('tabAll', lang) :
                    tab === 'renewals' ? t('tabRenewals', lang) :
                      tab === 'paid' ? t('tabPaid', lang) :
                        tab === 'defaulted' ? t('tabDefaulted', lang) :
                          tab === 'withdrawn' ? t('tabWithdrawn', lang) :
                            t('tabRaw', lang)}
                </button>
              ))}
            </div>

            <div className="p-0 overflow-x-auto overflow-y-auto max-h-[600px] relative">
              {/* Desktop Table View */}
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
                  {data.loans
                    .filter(l => {
                      if (activeTab === 'all') return !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn;
                      if (activeTab === 'renewals') return l.isRenewed;
                      if (activeTab === 'paid') return l.isPaid;
                      if (activeTab === 'defaulted') return l.isScam;
                      if (activeTab === 'withdrawn') return l.isWithdrawn;
                      return true;
                    })
                    .map((l, i) => (
                      <tr key={i} onClick={() => setSelectedLoan(l)} className="cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-400 text-xs">{l.id}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{l.name}</td>
                        <td className="px-4 py-3 text-right font-medium text-sm">{formatNumber(l.principal)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{l.interestRate}%</td>
                        <td className="px-4 py-3 text-center text-slate-500">{l.borrowDate}</td>
                        <td className="px-4 py-3 text-center text-slate-500 text-sm">{l.dueDate}</td>
                        <td className="px-4 py-3">{renderStatusBadge(l.status)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {/* Mobile Card View */}
              <div className="md:hidden" ref={tableRef as any}>
                {data.loans
                  .filter(l => {
                    if (activeTab === 'all') return !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn;
                    if (activeTab === 'renewals') return l.isRenewed;
                    if (activeTab === 'paid') return l.isPaid;
                    if (activeTab === 'defaulted') return l.isScam;
                    if (activeTab === 'withdrawn') return l.isWithdrawn;
                    return true;
                  })
                  .map((l, i) => {
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
                        key={i}
                        onClick={() => setSelectedLoan(l)}
                        className={`flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50 cursor-pointer ${stripeClass}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm ${avatarBg}`}>
                          {l.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 text-sm truncate">{l.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{l.id} · {l.dueDate}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-black text-slate-900 text-sm">{formatCurrency(l.principal)}</div>
                          {renderStatusBadge(l.status)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Premium Floating Style */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-40 pb-safe" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.02) 100%)' }}>
        <div className="mx-3 mb-3 h-[60px] bg-white border border-slate-200/80 flex shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] rounded-2xl px-1 items-center">
          {/* 1. Dashboard */}
          <button
            onClick={() => { setShowNewLoanModal(false); setShowWithdrawModal(false); setActiveMobileTab('dashboard'); }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all ${
              activeMobileTab === 'dashboard' ? 'bg-emerald-50' : ''
            }`}
          >
            <Home className={`w-5 h-5 transition-colors ${ activeMobileTab === 'dashboard' ? 'text-emerald-600 stroke-[2.5px]' : 'text-slate-400'}`} />
            <span className={`text-[9px] font-black uppercase tracking-tight ${ activeMobileTab === 'dashboard' ? 'text-emerald-600' : 'text-slate-400'}`}>{t('navDashboard', lang)}</span>
          </button>

          {/* 2. Analytics */}
          <button
            onClick={() => setActiveMobileTab('analytics')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all ${
              activeMobileTab === 'analytics' ? 'bg-emerald-50' : ''
            }`}
          >
            <BarChart2 className={`w-5 h-5 transition-colors ${ activeMobileTab === 'analytics' ? 'text-emerald-600 stroke-[2.5px]' : 'text-slate-400'}`} />
            <span className={`text-[9px] font-black uppercase tracking-tight ${ activeMobileTab === 'analytics' ? 'text-emerald-600' : 'text-slate-400'}`}>{t('navAnalytics', lang)}</span>
          </button>

          {/* 3. New Loan — primary CTA */}
          <button
            onClick={() => setShowNewLoanModal(true)}
            className="flex-1 flex flex-col items-center justify-center -mt-5"
          >
            <div className="w-13 h-13 flex items-center justify-center rounded-2xl shadow-lg shadow-emerald-200/60 border-4 border-white active:scale-90 transition-transform" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Activity className="w-6 h-6 text-white stroke-[2.5px]" />
            </div>
          </button>

          {/* 4. Withdraw */}
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex-1 flex flex-col items-center justify-center -mt-5"
          >
            <div className="w-13 h-13 flex items-center justify-center rounded-2xl shadow-lg shadow-rose-200/60 border-4 border-white active:scale-90 transition-transform" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>
              <Wallet className="w-6 h-6 text-white stroke-[2.5px]" />
            </div>
          </button>

          {/* 5. Loans List */}
          <button
            onClick={() => setActiveMobileTab('loans')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all ${
              activeMobileTab === 'loans' ? 'bg-emerald-50' : ''
            }`}
          >
            <List className={`w-5 h-5 transition-colors ${ activeMobileTab === 'loans' ? 'text-emerald-600 stroke-[2.5px]' : 'text-slate-400'}`} />
            <span className={`text-[9px] font-black uppercase tracking-tight ${ activeMobileTab === 'loans' ? 'text-emerald-600' : 'text-slate-400'}`}>{t('navLoans', lang)}</span>
          </button>
        </div>
      </div>

      {/* Loan Details & Action Modal */}
      {selectedLoan && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setSelectedLoan(null)}
        >
          <div
            className="bg-white w-full md:rounded-2xl md:max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] rounded-t-3xl animate-sheet-up md:animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar mobile */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Status-aware gradient header */}
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
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold uppercase">⚠ Overdue</span>
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
              {/* Financials Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Financial Details</h3>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {isEditingLoan ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Principal</label>
                        <input
                          type="number"
                          value={editLoanForm.principal}
                          onChange={e => setEditLoanForm({ ...editLoanForm, principal: e.target.value })}
                          className="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Interest Rate (%)</label>
                        <input
                          type="number"
                          value={editLoanForm.interestRate}
                          onChange={e => setEditLoanForm({ ...editLoanForm, interestRate: Number(e.target.value) })}
                          className="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
                        <span className="text-slate-700 font-bold">New Expected</span>
                        <span className="font-black text-xl text-indigo-600">
                          {formatCurrency(parseFloat(editLoanForm.principal) + ((parseFloat(editLoanForm.principal) * editLoanForm.interestRate) / 100))}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 text-sm">Principal</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(selectedLoan.principal)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 text-sm">Interest Rate</span>
                        <span className="font-semibold text-slate-800">{selectedLoan.interestRate}%</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 text-sm">Expected Interest</span>
                        <span className="font-semibold text-emerald-600">+{formatCurrency(selectedLoan.expectedInterest)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                        <span className="text-slate-500 text-sm">Penalty Fee</span>
                        <span className="font-semibold text-amber-600">+{formatCurrency(selectedLoan.penalty)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700 font-bold">Total Expected</span>
                        <span className="font-black text-xl text-slate-900">{formatCurrency(selectedLoan.totalExpected)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payments Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Payments & Dates</h3>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-emerald-700 text-sm">Total Paid</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(selectedLoan.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-emerald-600/80 pl-2 border-l-2 border-emerald-200 ml-1">
                    <span>Principal Paid</span>
                    <span>{formatCurrency(selectedLoan.paidPrincipal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-emerald-600/80 pl-2 border-l-2 border-emerald-200 ml-1 mt-1">
                    <span>Interest Paid</span>
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
                    <p className="text-[10px] text-indigo-500 mt-2 leading-tight">These are the historical interest payments made by this customer to extend this specific loan sequence before paying off the principal.</p>
                  </div>
                )}

                {selectedLoan.penaltyHistory && selectedLoan.penaltyHistory.length > 0 && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-amber-800 text-sm font-semibold">{t('penaltyHistory', lang)}</span>
                      <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">{selectedLoan.penaltyHistory.length} {t('times', lang)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-3 border-b border-amber-200/50 pb-2">
                      <span className="text-amber-700">{t('totalPenaltyPaid', lang)}</span>
                      <span className="font-black text-amber-700">
                        {formatCurrency(selectedLoan.penaltyHistory.reduce((sum, p) => sum + p.amount, 0))}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                      {selectedLoan.penaltyHistory.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-white/60 p-2 rounded border border-amber-100/50 shadow-sm">
                          <span className="text-amber-600 font-medium">{t('round', lang)} {idx + 1} <span className="text-amber-500/80 font-normal ml-1">({p.date})</span></span>
                          <span className="text-amber-800 font-bold">{formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 mb-1">{t('issueDate', lang)}</div>
                    <div className="font-semibold text-slate-800">{selectedLoan.borrowDate}</div>
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
                        <div className="text-xs font-bold text-slate-500 mt-2 mb-1">{t('days', lang)}</div>
                        <input
                          type="number"
                          min="1"
                          value={editLoanForm.daysBorrowed}
                          onChange={e => handleEditDaysChange(Number(e.target.value))}
                          className="w-full border border-slate-300 rounded p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

                {selectedLoan.daysLate > 0 && (
                  <div className="flex items-center gap-2 mt-2 p-3 bg-rose-50 rounded-lg text-rose-700 text-sm border border-rose-100">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">{lang === 'th' ? 'ค้างชำระ' : 'Currently'} {selectedLoan.daysLate} {t('daysOverdueText', lang)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons Section */}
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
                      onClick={() => handleUpdateStatus('โดนบิด')}
                      className="py-3.5 font-bold rounded-xl text-white text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                      style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
                    >
                      <UserX className="w-4 h-4" /> {t('default', lang)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expanded Analytics Modal */}
      {showExpandedTrend && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lg:p-8 bg-slate-900/70 backdrop-blur-sm"
          onClick={() => { setShowExpandedTrend(false); setInsightDate(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] lg:h-[85vh] overflow-hidden flex flex-col animate-[slideIn_0.2s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-slate-200 bg-white">
              <div>
                <h2 className="text-xl lg:text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Activity className="w-6 h-6 lg:w-7 lg:h-7 text-indigo-600" /> Advanced Cashflow Analytics
                </h2>
                <p className="text-sm text-slate-500 mt-1 font-medium">30-Day Cashflow History & Daily Drill-down Insights</p>
              </div>
              <button onClick={() => { setShowExpandedTrend(false); setInsightDate(null); }} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"><X size={24} /></button>
            </div>

            {/* Split Body */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50">

              {/* Left: Big Chart */}
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
                          setInsightDate(e.activeLabel);
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

              {/* Right: Insights */}
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

                    {/* Expected */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">{t('expectedInterestDue', lang)}</h3>
                      <div className="space-y-2">
                        {data.loans.filter(l => l.dueDate && l.dueDate.startsWith(insightDate)).map(l => (
                          <div key={'exp-' + l.id} className="flex justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                            <div>
                              <div className="font-bold text-slate-800">{l.name} <span className="text-xs text-slate-400 font-normal">({l.id})</span></div>
                              <div className="text-[10px] text-slate-500 mt-0.5">Principal: {formatCurrency(l.principal)}</div>
                            </div>
                            <div className="flex flex-col items-end justify-center">
                              <span className="font-black text-slate-700">{formatCurrency(l.expectedInterest)}</span>
                              {l.isPaid && <span className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5">Paid</span>}
                              {l.isRenewed && <span className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">Renewed</span>}
                              {l.isScam && <span className="text-[10px] text-rose-600 font-bold uppercase mt-0.5">Defaulted</span>}
                            </div>
                          </div>
                        ))}
                        {data.loans.filter(l => l.dueDate && l.dueDate.startsWith(insightDate)).length === 0 && (
                          <div className="p-4 bg-white rounded-lg text-sm text-slate-400 italic text-center border border-slate-200 border-dashed">{t('noExpectedForDate', lang)}</div>
                        )}
                      </div>
                    </div>

                    {/* Received */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 text-emerald-600"><CheckCircle2 className="w-4 h-4" /> {t('actualPaymentsReceived', lang)}</h3>
                      <div className="space-y-2">
                        {data.loans.filter(l => l.actualDate && l.actualDate.startsWith(insightDate) && l.paidInterest > 0).map(l => (
                          <div key={'rec-' + l.id} className="flex justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200 shadow-sm hover:border-emerald-400 transition-colors">
                            <div>
                              <div className="font-bold text-emerald-900">{l.name} <span className="text-xs text-emerald-600/60 font-normal">({l.id})</span></div>
                              <div className="text-[10px] text-emerald-600/80 mt-0.5">{l.status}</div>
                            </div>
                            <div className="flex items-center">
                              <span className="font-black text-emerald-700 text-base">+{formatCurrency(l.paidInterest)}</span>
                            </div>
                          </div>
                        ))}
                        {data.loans.filter(l => l.actualDate && l.actualDate.startsWith(insightDate) && l.paidInterest > 0).length === 0 && (
                          <div className="p-4 bg-white rounded-lg text-sm text-slate-400 italic text-center border border-slate-200 border-dashed">{t('noPaymentsForDate', lang)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Progress Insights Modal */}
      {showPortfolioProgressModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPortfolioProgressModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-[slideIn_0.2s_ease-out] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-emerald-50/30">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-600" />
                  {t('portfolioInsights', lang)}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{t('portfolioInsightsDesc', lang)}</p>
              </div>
              <button onClick={() => setShowPortfolioProgressModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('totalExpectedValue', lang)}</div>
                  <div className="text-3xl font-black text-slate-800">{formatCurrency(s.totalExpected)}</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">{t('totalCollected', lang)}</div>
                  <div className="text-3xl font-black text-emerald-700">{formatCurrency(s.totalPaid)}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200 text-sm font-bold text-slate-600 uppercase">{t('principalBreakdown', lang)}</div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">{t('principalLentOut', lang)}</span>
                      <span className="font-bold text-slate-800">{formatCurrency(s.totalBorrowed)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-emerald-300">
                      <span className="text-emerald-700 text-sm">{t('principalCollected', lang)}</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(s.paidPrincipal)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-amber-300">
                      <span className="text-amber-700 text-sm">{t('principalRemaining', lang)}</span>
                      <span className="font-bold text-amber-700">{formatCurrency(s.unpaidPrincipal)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-rose-300">
                      <span className="text-rose-700 text-sm">{t('principalLost', lang)}</span>
                      <span className="font-bold text-rose-700">{formatCurrency(s.scamPrincipal)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200 text-sm font-bold text-slate-600 uppercase">{t('interestBreakdown', lang)}</div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">{t('interestExpected', lang)}</span>
                      <span className="font-bold text-slate-800">{formatCurrency(s.totalInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-emerald-300">
                      <span className="text-emerald-700 text-sm">{t('interestCollected', lang)}</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(s.paidInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-amber-300">
                      <span className="text-amber-700 text-sm">{t('interestRemaining', lang)}</span>
                      <span className="font-bold text-amber-700">{formatCurrency(s.unpaidInterest)}</span>
                    </div>
                  </div>
                </div>
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
                  {[500, 1000, 1500, 2000, 2500, 3000].map(amt => (
                    <button
                      key={amt} type="button"
                      onClick={() => setWithdrawForm({ ...withdrawForm, principal: amt.toString() })}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100"
                    >
                      {formatNumber(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('withdrawalDate', lang)}</label>
                <DatePicker
                  selected={withdrawForm.date}
                  onChange={(date: Date) => setWithdrawForm({ ...withdrawForm, date: date || new Date() })}
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

            <div className="pt-4 border-t border-slate-100 mt-2 px-5 pb-5 flex justify-end gap-3">
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
                  {[500, 1000, 1500, 2000, 2500, 3000].map(amt => (
                    <button
                      key={amt} type="button"
                      onClick={() => setNewLoanForm({ ...newLoanForm, principal: amt.toString() })}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                    >
                      {formatNumber(amt)}
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
                  <input
                    type="number"
                    required
                    min="1"
                    value={newLoanForm.daysBorrowed}
                    onChange={e => handleDaysChange(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
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

            <div className="pt-4 border-t border-slate-100 mt-2 px-5 pb-5 flex justify-end gap-3">
              <button type="button" onClick={() => setShowNewLoanModal(false)} className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors text-sm">{t('cancel', lang)}</button>
              <button type="submit" disabled={isSyncing} className="px-5 py-2.5 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 text-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                {isSyncing ? t('saving', lang) : t('addLoan', lang)}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotifModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setShowNotifModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">{t('notifTitle', lang)}</h2>
                  <p className="text-xs text-slate-500">Notification Settings</p>
                </div>
              </div>
              <button onClick={() => setShowNotifModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${isSubscribed ? 'bg-emerald-50 border-emerald-200' : notifPermission === 'denied' ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
                }`}>
                <div className={`w-3 h-3 rounded-full ${isSubscribed ? 'bg-emerald-500 animate-pulse' : notifPermission === 'denied' ? 'bg-rose-500' : 'bg-slate-300'
                  }`}></div>
                <div>
                  <p className={`text-sm font-bold ${isSubscribed ? 'text-emerald-800' : notifPermission === 'denied' ? 'text-rose-700' : 'text-slate-600'}`}>
                    {isSubscribed ? t('notifEnabled', lang) : notifPermission === 'denied' ? t('notifBlocked', lang) : t('notifDisabled', lang)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSubscribed ? t('notifEnabledDesc', lang) : notifPermission === 'denied' ? t('notifBlockedDesc', lang) : t('notifDisabledDesc', lang)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-center">
                  <div className="text-2xl mb-1">🌅</div>
                  <div className="text-sm font-bold text-amber-800">06:00 น.</div>
                  <div className="text-xs text-amber-600 mt-1">{t('morningAlert', lang)}</div>
                </div>
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center">
                  <div className="text-2xl mb-1">🔔</div>
                  <div className="text-sm font-bold text-indigo-800">16:00 น.</div>
                  <div className="text-xs text-indigo-600 mt-1">{t('afternoonAlert', lang)}</div>
                </div>
              </div>
              <div className="space-y-3">
                {!isSubscribed ? (
                  <button
                    onClick={async () => {
                      const sub = await subscribeToPush();
                      if (sub) { setIsSubscribed(true); setNotifPermission('granted'); showToast(t('notifSuccess', lang), 'success'); setShowNotifModal(false); }
                      else showToast(t('notifFailed', lang), 'error');
                    }}
                    disabled={notifPermission === 'denied'}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Bell className="w-4 h-4" /> {t('enableNotif', lang)}
                  </button>
                ) : (
                  <button
                    onClick={async () => { await unsubscribeFromPush(); setIsSubscribed(false); showToast(t('notifDisabledToast', lang), 'success'); setShowNotifModal(false); }}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <BellOff className="w-4 h-4" /> {t('disableNotif', lang)}
                  </button>
                )}
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{t('testNotif', lang)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={!isSubscribed || isSendingTestNotif}
                      onClick={async () => {
                        setIsSendingTestNotif(true);
                        const t = new Date(); t.setHours(0, 0, 0, 0);
                        const dueCount = data ? data.loans.filter(l => { if (l.isPaid || l.isScam || l.isRenewed || l.isWithdrawn) return false; const d = parseThaiDate(l.dueDate); return d && d.getTime() === t.getTime(); }).length : 0;
                        const overdueCount = data ? data.loans.filter(l => l.isOverdue && !l.isPaid && !l.isScam && !l.isRenewed && !l.isWithdrawn).length : 0;
                        await sendTestNotification('🌅 LoanTrack - สรุปยอดวันนี้', `📋 นัดชำระวันนี้: ${dueCount} ราย | ⚠️ ค้างชำระ: ${overdueCount} ราย`);
                        setIsSendingTestNotif(false);
                      }}
                      className="py-2 px-3 text-xs font-bold bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      🌅 ทดสอบ 06:00
                    </button>
                    <button
                      disabled={!isSubscribed || isSendingTestNotif}
                      onClick={async () => {
                        setIsSendingTestNotif(true);
                        const t = new Date(); t.setHours(0, 0, 0, 0);
                        const unpaid = data ? data.loans.filter(l => { if (l.isPaid || l.isScam || l.isRenewed || l.isWithdrawn) return false; const d = parseThaiDate(l.dueDate); return d && d.getTime() === t.getTime(); }).length : 0;
                        await sendTestNotification('🔔 LoanTrack - ต้องทวงวันนี้!', unpaid > 0 ? `💬 ยังมี ${unpaid} ราย ที่ยังไม่ชำระในวันนี้ รีบตามทวงด่วน!` : '✅ ยอดทั้งหมดของวันนี้ชำระแล้ว!');
                        setIsSendingTestNotif(false);
                      }}
                      className="py-2 px-3 text-xs font-bold bg-indigo-100 text-indigo-800 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      🔔 ทดสอบ 16:00
                    </button>
                  </div>
                  {!isSubscribed && <p className="text-xs text-slate-400 text-center mt-2">เปิดการแจ้งเตือนก่อนเพื่อทดสอบ</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className={`fixed z-[100] animate-slide-down pointer-events-none
          top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm
          md:top-auto md:bottom-6 md:right-6 md:left-auto md:translate-x-0 md:w-auto
        `}>
          <div className={`px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-white font-bold text-sm ${
            toastMessage.type === 'success'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
              : 'bg-gradient-to-r from-rose-600 to-rose-500'
          }`}>
            {toastMessage.type === 'success'
              ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

