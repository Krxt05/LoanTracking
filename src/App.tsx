import React, { useEffect, useState } from 'react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fetchAppData, AppData, LoanRecord, updateLoanStatus, createNewLoan, editExistingLoan } from './services/dataService';
import { formatCurrency, formatNumber, parseThaiDate } from './lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, CalendarClock, Activity, FileSpreadsheet, List, X, CheckCircle2, UserX, Wallet, RefreshCcw, LineChart } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAutoAnimate } from '@formkit/auto-animate/react';

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
        daysBorrowed: parseInt(selectedLoan.daysBorrowed) || 7,
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
        showToast(`New loan added successfully!`, 'success');
        setShowNewLoanModal(false);
        setNewLoanForm({ ...newLoanForm, name: '', principal: '500' });
        setTimeout(() => loadData(true), 2500);
      } else {
        throw new Error("API returned failure");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to add new loan.", 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawForm.principal) return;

    setIsSyncing(true);
    const pValue = parseFloat(withdrawForm.principal);
    const name = withdrawForm.name.trim() || "ถอน";

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
        showToast(`Withdrawal recorded successfully!`, 'success');
        setShowWithdrawModal(false);
        setWithdrawForm({ name: '', principal: '', date: new Date() });
        setTimeout(() => loadData(true), 2500);
      } else {
        throw new Error("API returned failure");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to record withdrawal.", 'error');
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
            daysBorrowed: editLoanForm.daysBorrowed.toString(),
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
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 font-medium">Initialize Data Model...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-200 text-center">
          <p className="text-red-600 font-bold mb-2 flex justify-center items-center gap-2"><AlertCircle className="w-5 h-5" /> Data Connection Failed</p>
          <p className="text-slate-500 text-sm">Failed to sync with the central database.</p>
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
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-200">Paid</span>;
    }
    if (s.includes('ต่อดอก') || s.includes('renew')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider border border-indigo-200">Renewed</span>;
    }
    if (s.includes('บิด') || s.includes('default')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider border border-rose-200">Defaulted</span>;
    }
    if (s.includes('เบิก') || s.includes('withdraw') || s.includes('payout')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider border border-amber-200">Payout</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider border border-slate-200">Active</span>;
  };

  const MetricRow = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-slate-500 text-sm font-medium mb-1">Total Portfolio Size</div>
        <div className="text-2xl font-bold text-slate-800">{formatCurrency(s.totalLimit)}</div>
        <div className="text-xs text-emerald-600 mt-2 flex items-center font-medium">
          <TrendingUp className="w-3 h-3 mr-1" /> Active Limit
        </div>
      </div>
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-slate-500 text-sm font-medium mb-1">Net Profit</div>
        <div className="text-2xl font-bold text-slate-800">{formatCurrency(s.netProfit)}</div>
        <div className="text-xs text-emerald-600 mt-2 flex items-center font-medium">
          <TrendingUp className="w-3 h-3 mr-1" /> {s.profitPct}% Margin
        </div>
      </div>
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-slate-500 text-sm font-medium mb-1">NPL Ratio / Bad Debt</div>
        <div className="text-2xl font-bold text-slate-800">{((s.scamPrincipal / Math.max(1, s.totalBorrowed)) * 100).toFixed(1)}%</div>
        <div className="text-xs text-rose-600 mt-2 flex items-center font-medium">
          <TrendingDown className="w-3 h-3 mr-1" /> {formatCurrency(s.scamPrincipal)} Lost
        </div>
      </div>
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-slate-500 text-sm font-medium mb-1">Available Balance</div>
        <div className="text-2xl font-bold text-slate-800">{formatCurrency(s.available)}</div>
        <div className="text-xs text-slate-500 mt-2 flex items-center font-medium">
          Ready to lend
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Activity className="w-8 h-8 text-emerald-600" />
              Loan Portfolio Management
            </h1>
            <p className="text-slate-500 mt-1">Professional financial dashboard & analytics</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all"
            >
              <Wallet className="w-4 h-4" /> Withdraw
            </button>
            <button
              onClick={() => setShowNewLoanModal(true)}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all"
            >
              <Activity className="w-4 h-4" /> New Loan
            </button>
            {isSyncing ? (
              <span className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                <RefreshCcw className="w-4 h-4 animate-spin" /> Syncing data...
              </span>
            ) : (
              <button onClick={() => loadData()} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 p-2 rounded-full hover:bg-slate-200 transition-colors">
                <RefreshCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        <MetricRow />

        {/* Section 2: Action & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-amber-50 rounded-lg border border-amber-200 flex flex-col">
            <div className="p-4 border-b border-amber-200 bg-amber-100/50 flex font-bold text-amber-800 items-center gap-2">
              <CalendarClock className="w-5 h-5" /> DUE TODAY ({dueTodayLoans.length})
            </div>
            <div className="p-4 max-h-[200px] overflow-y-auto">
              {dueTodayLoans.length === 0 ? (
                <p className="text-sm border-l-2 border-amber-300 pl-3 text-amber-700 py-1">No collections scheduled for today.</p>
              ) : (
                <div className="space-y-3" ref={dueListRef}>
                  {dueTodayLoans.map(l => (
                    <div
                      key={l.id}
                      onClick={() => setSelectedLoan(l)}
                      className="flex justify-between items-center text-sm p-3 bg-white rounded border border-amber-100 shadow-sm cursor-pointer hover:border-amber-300 hover:bg-amber-50 transition-colors"
                    >
                      <span className="font-semibold">{l.name} <span className="text-xs text-slate-400 font-normal ml-1">({l.id})</span></span>
                      <span className="font-bold text-amber-700">{formatCurrency(l.totalExpected)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-rose-50 rounded-lg border border-rose-200 flex flex-col">
            <div className="p-4 border-b border-rose-200 bg-rose-100/50 flex font-bold text-rose-800 items-center gap-2">
              <AlertCircle className="w-5 h-5" /> OVERDUE ALERTS ({overdueLoans.length})
            </div>
            <div className="p-4 max-h-[200px] overflow-y-auto">
              {overdueLoans.length === 0 ? (
                <p className="text-sm border-l-2 border-slate-300 pl-3 text-slate-500 py-1">No overdue accounts.</p>
              ) : (
                <div className="space-y-3" ref={overdueListRef}>
                  {overdueLoans.sort((a, b) => b.daysLate - a.daysLate).map(l => (
                    <div
                      key={l.id}
                      onClick={() => setSelectedLoan(l)}
                      className="flex justify-between items-center text-sm p-3 bg-white rounded border border-rose-100 shadow-sm cursor-pointer hover:border-rose-300 hover:bg-rose-50 transition-colors"
                    >
                      <div>
                        <div className="font-semibold">{l.name}</div>
                        <div className="text-xs text-rose-600 font-medium">{l.daysLate} Days Overdue</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-rose-700">{formatCurrency(l.totalExpected)}</div>
                        <div className="text-xs text-slate-400">Due {l.dueDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Visualizations */}
        <h2 className="text-lg font-bold mb-4 text-slate-800">Portfolio Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div
            className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col items-center cursor-pointer group hover:border-emerald-300 hover:shadow-md transition-all relative overflow-hidden"
            onClick={() => setShowPortfolioProgressModal(true)}
          >
            <div className="w-full flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-slate-500">Portfolio Progress</h3>
              <span className="text-xs text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md font-medium border border-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity">Click for Insights</span>
            </div>

            <div className="h-[140px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={progressData}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={80}
                    outerRadius={110}
                    dataKey="value"
                    stroke="none"
                  >
                    {progressData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(val: number) => [formatCurrency(val), 'Amount']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute bottom-0 left-0 right-0 text-center flex flex-col items-center justify-end pb-2">
                <span className="text-3xl font-black text-slate-800">{progressPct}%</span>
                <span className="text-xs font-bold text-emerald-600">Collected</span>
              </div>
            </div>
            <div className="w-full mt-6 grid grid-cols-2 gap-4 text-center">
              <div className="bg-emerald-50/50 p-2 rounded border border-emerald-100">
                <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Collected</div>
                <div className="font-bold text-slate-800 text-sm">{formatCurrency(s.totalPaid)}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Remaining</div>
                <div className="font-bold text-slate-800 text-sm">{formatCurrency(s.totalUnpaid)}</div>
              </div>
            </div>
          </div>

          <div
            className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col cursor-pointer group hover:border-indigo-300 hover:shadow-md transition-all"
            onClick={() => setShowExpandedTrend(true)}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-500">Cashflow Trend (14 Days)</h3>
              <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md font-medium border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">Click to Expand</span>
            </div>
            <div className="h-[250px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData14} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="Expected" barSize={16} fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Received" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Section 4: Data Management & History */}
        <h2 className="text-lg font-bold mb-4 text-slate-800">Data Management</h2>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-12">
          <div className="flex border-b border-slate-200 bg-slate-50/50">
            {['all', 'renewals', 'paid', 'defaulted', 'withdrawn', 'raw'].map(tab => (
              <button
                key={tab}
                className={`px-6 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500'}`}
                onClick={() => setActiveTab(tab as any)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-0 overflow-x-auto overflow-y-auto max-h-[500px] relative">
            <table className="w-full text-left whitespace-nowrap text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-[0_1px_0_#E2E8F0]">
                <tr>
                  <th className="px-5 py-3">Customer ID</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3 text-right">Principal</th>
                  <th className="px-5 py-3 text-right">Interest Rate</th>
                  <th className="px-5 py-3 text-center">Issue Date</th>
                  <th className="px-5 py-3 text-center">Due Date</th>
                  <th className="px-5 py-3">Status</th>
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
                    <tr key={i} onClick={() => setSelectedLoan(l)} className="cursor-pointer hover:bg-slate-100 transition-colors">
                      <td className="px-5 py-3 font-mono text-slate-400 text-xs">{l.id}</td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{l.name}</td>
                      <td className="px-5 py-3 text-right font-medium">{formatNumber(l.principal)}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{l.interestRate}%</td>
                      <td className="px-5 py-3 text-center text-slate-500">{l.borrowDate}</td>
                      <td className="px-5 py-3 text-center text-slate-500">{l.dueDate}</td>
                      <td className="px-5 py-3">{renderStatusBadge(l.status)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Loan Details & Action Modal */}
      {selectedLoan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setSelectedLoan(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                  {selectedLoan.name}
                  <button
                    onClick={() => setIsEditingLoan(!isEditingLoan)}
                    className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors ml-2 ${isEditingLoan ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {isEditingLoan ? 'Cancel Edit' : '✏️ Edit Details'}
                  </button>
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-mono text-slate-500">ID: {selectedLoan.id}</span>
                  {selectedLoan.isScam ? (
                    <span className="inline-flex px-2 py-0.5 rounded bg-rose-500 text-white text-xs font-black uppercase shadow-sm">💀 Defaulted</span>
                  ) : selectedLoan.isWithdrawn ? (
                    <span className="inline-flex px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold uppercase shadow-sm">Payout</span>
                  ) : selectedLoan.isPaid ? (
                    <span className="inline-flex px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-bold uppercase">Paid</span>
                  ) : selectedLoan.isRenewed ? (
                    <span className="inline-flex px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-bold uppercase">Renewed</span>
                  ) : selectedLoan.isOverdue ? (
                    <span className="inline-flex px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs font-bold uppercase">Overdue</span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-bold uppercase">Active</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedLoan(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={24} />
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
                      <span className="text-indigo-800 text-sm font-semibold">Renewal History (Current Cycle)</span>
                      <span className="bg-indigo-200 text-indigo-800 text-xs px-2 py-0.5 rounded-full font-bold">{selectedLoan.historicalRenewalCount} Times</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-indigo-600">Total Interest Accumulated</span>
                      <span className="font-black text-indigo-700">{formatCurrency(selectedLoan.historicalRenewalInterest)}</span>
                    </div>
                    <p className="text-[10px] text-indigo-500 mt-2 leading-tight">These are the historical interest payments made by this customer to extend this specific loan sequence before paying off the principal.</p>
                  </div>
                )}

                {selectedLoan.penaltyHistory && selectedLoan.penaltyHistory.length > 0 && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-amber-800 text-sm font-semibold">Penalty Payment History</span>
                      <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">{selectedLoan.penaltyHistory.length} Times</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-3 border-b border-amber-200/50 pb-2">
                      <span className="text-amber-700">Total Penalty Paid</span>
                      <span className="font-black text-amber-700">
                        {formatCurrency(selectedLoan.penaltyHistory.reduce((sum, p) => sum + p.amount, 0))}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                      {selectedLoan.penaltyHistory.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-white/60 p-2 rounded border border-amber-100/50 shadow-sm">
                          <span className="text-amber-600 font-medium">Round {idx + 1} <span className="text-amber-500/80 font-normal ml-1">({p.date})</span></span>
                          <span className="text-amber-800 font-bold">{formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 mb-1">Issue Date</div>
                    <div className="font-semibold text-slate-800">{selectedLoan.borrowDate}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {isEditingLoan ? (
                      <>
                        <div className="text-xs font-bold text-slate-500 mb-1">Due Date</div>
                        <DatePicker
                          selected={editLoanForm.dueDate}
                          onChange={handleEditDueDateChange}
                          dateFormat="dd/MM/yyyy"
                          className="w-full border border-slate-300 rounded p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white"
                        />
                        <div className="text-xs font-bold text-slate-500 mt-2 mb-1">Days</div>
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
                        <div className="text-xs text-slate-500 mb-1">Due Date</div>
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
                    <span className="font-medium">Currently {selectedLoan.daysLate} days overdue</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons Section */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              {isEditingLoan ? (
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSyncing}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 w-full justify-center"
                  >
                    {isSyncing ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-bold text-slate-600 whitespace-nowrap">Action Date:</label>
                    <DatePicker
                      selected={actionDate}
                      onChange={(date) => date && setActionDate(date)}
                      dateFormat="dd/MM/yyyy"
                      className="border border-slate-300 rounded p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white w-32"
                    />
                  </div>
                  <div className="flex justify-end gap-3 flex-wrap">
                    <button
                      onClick={() => handleUpdateStatus('ชำระแล้ว')}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Paid
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('ต่อดอก')}
                      className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Activity className="w-4 h-4" /> Renew
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('โดนบิด')}
                      className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <UserX className="w-4 h-4" /> Default
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
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">30-Day Trend</h3>
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full font-bold border border-indigo-100 animate-pulse">Click any bar to view details</span>
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
                    <p className="font-extrabold text-lg text-slate-700">No Date Selected</p>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">Select a specific date on the graph to drill down into the detailed loan collections and expected payments for that day.</p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                      <div className="bg-indigo-600 text-white p-2 rounded-lg"><CalendarClock className="w-5 h-5" /></div>
                      <div>
                        <h2 className="text-xl font-black text-slate-800">{insightDate}</h2>
                        <p className="text-xs font-bold text-indigo-600 uppercase">Daily Insight Report</p>
                      </div>
                    </div>

                    {/* Expected */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">Expected Interest (Due)</h3>
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
                          <div className="p-4 bg-white rounded-lg text-sm text-slate-400 italic text-center border border-slate-200 border-dashed">No expected interest for this date.</div>
                        )}
                      </div>
                    </div>

                    {/* Received */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Actually Received</h3>
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
                          <div className="p-4 bg-white rounded-lg text-sm text-slate-400 italic text-center border border-slate-200 border-dashed">No received interest on this date.</div>
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
                  Portfolio Progress Insights
                </h2>
                <p className="text-sm text-slate-500 mt-1">Detailed breakdown of expected vs. collected returns.</p>
              </div>
              <button onClick={() => setShowPortfolioProgressModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Expected Value</div>
                  <div className="text-3xl font-black text-slate-800">{formatCurrency(s.totalExpected)}</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Total Collected</div>
                  <div className="text-3xl font-black text-emerald-700">{formatCurrency(s.totalPaid)}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200 text-sm font-bold text-slate-600 uppercase">Principal Breakdown</div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Total Principal Lent Out</span>
                      <span className="font-bold text-slate-800">{formatCurrency(s.totalBorrowed)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-emerald-300">
                      <span className="text-emerald-700 text-sm">Principal Collected</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(s.paidPrincipal)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-amber-300">
                      <span className="text-amber-700 text-sm">Principal Remaining / Active</span>
                      <span className="font-bold text-amber-700">{formatCurrency(s.unpaidPrincipal)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-rose-300">
                      <span className="text-rose-700 text-sm">Principal Defaulted (Lost)</span>
                      <span className="font-bold text-rose-700">{formatCurrency(s.scamPrincipal)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200 text-sm font-bold text-slate-600 uppercase">Interest Breakdown</div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Total Interest Expected</span>
                      <span className="font-bold text-slate-800">{formatCurrency(s.totalInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-emerald-300">
                      <span className="text-emerald-700 text-sm">Interest Collected</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(s.paidInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 border-l-2 border-amber-300">
                      <span className="text-amber-700 text-sm">Interest Remaining / Active</span>
                      <span className="font-bold text-amber-700">{formatCurrency(s.unpaidInterest)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowWithdrawModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[slideIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Wallet className="text-rose-600" /> New Payout (Withdrawal)</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payout Amount</label>
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
                      onClick={() => setWithdrawForm({...withdrawForm, principal: amt.toString()})}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100"
                    >
                      {formatNumber(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Withdrawal Date</label>
                <DatePicker
                  selected={withdrawForm.date}
                  onChange={(date: Date) => setWithdrawForm({ ...withdrawForm, date: date || new Date() })}
                  dateFormat="dd/MM/yyyy"
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reference / Description</label>
                <input
                  type="text"
                  value={withdrawForm.name}
                  onChange={e => setWithdrawForm({ ...withdrawForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Withdrawal (default)"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowWithdrawModal(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isSyncing} className="px-5 py-2.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50">
                  {isSyncing ? 'Saving...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Loan Modal */}
      {showNewLoanModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowNewLoanModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[slideIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Activity className="text-indigo-600" /> Issue New Loan</h3>
              <button onClick={() => setShowNewLoanModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateNewLoan} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Borrower Name</label>
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Principal Amount</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Borrow Date</label>
                  <DatePicker
                    selected={newLoanForm.borrowDate}
                    onChange={handleBorrowDateChange}
                    dateFormat="dd/MM/yyyy"
                    className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white"
                  />
                </div>
                <div className="flex flex-col relative z-20">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Due Date</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Days Borrowed</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Interest Rate (%)</label>
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

              <div className="pt-4 border-t border-slate-100 mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowNewLoanModal(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isSyncing} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50">
                  {isSyncing ? 'Saving...' : 'Add Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-[bounce_0.5s_ease-in-out]">
          <div className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 text-white font-bold ${toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            {toastMessage.text}
          </div>
        </div>
      )}
    </div>
  );
}

