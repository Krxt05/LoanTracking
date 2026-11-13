// Shared mock data + format helpers for all three directions.
// Numbers in THB (Thai baht). Names lightly transliterated.

window.SEED = (() => {
  const summary = {
    totalLimit: 32400,      // current portfolio cap
    initialCapital: 20000,  // seed money
    netProfit: 4820,        // interest received - scams - withdrawals
    grossProfit: 5240,
    profitPct: 14.9,
    nplRatio: 3.1,
    available: 8200,        // free cash to lend
    deployed: 24200,        // currently out
    withdrawn: 1200,
    monthInterest: 1240,
    monthInterestPrev: 1080,
    activeCount: 7,
    overdueCount: 1,
    dueTodayCount: 1,
    paidThisMonth: 4,
  };

  const loans = [
    { id: 'L240312', name: 'Aom S.',  principal: 5000, rate: 5, interest: 250, total: 5250,
      due: 'May 12', dueRel: 'Today', daysLeft: 0,  status: 'due-today',
      borrowed: 'May 5',  days: 7, avatar: 'AS', color: 'amber' },

    { id: 'L240310', name: 'Bank P.', principal: 3000, rate: 4, interest: 120, total: 3120,
      due: 'May 09', dueRel: '3d late', daysLeft: -3, status: 'overdue',
      borrowed: 'May 2',  days: 7, avatar: 'BP', color: 'rose' },

    { id: 'L240308', name: 'Mint K.', principal: 7500, rate: 5, interest: 375, total: 7875,
      due: 'May 18', dueRel: 'in 6d',  daysLeft: 6,  status: 'active',
      borrowed: 'May 4',  days: 14, avatar: 'MK', color: 'emerald' },

    { id: 'L240301', name: 'Nine T.', principal: 4000, rate: 5, interest: 200, total: 4200,
      due: 'May 22', dueRel: 'in 10d', daysLeft: 10, status: 'active',
      borrowed: 'May 8',  days: 14, avatar: 'NT', color: 'sky' },

    { id: 'L240228', name: 'Tee J.',  principal: 6000, rate: 5, interest: 300, total: 6300,
      due: 'May 25', dueRel: 'in 13d', daysLeft: 13, status: 'renewed', renewCount: 2,
      borrowed: 'May 4',  days: 21, avatar: 'TJ', color: 'indigo' },

    { id: 'L240221', name: 'Fern R.', principal: 2500, rate: 5, interest: 125, total: 2625,
      due: 'May 03', dueRel: 'paid May 3', daysLeft: 0, status: 'paid',
      borrowed: 'Apr 26', days: 7, avatar: 'FR', color: 'cyan' },

    { id: 'L240215', name: 'Gun W.',  principal: 1800, rate: 5, interest: 90, total: 1890,
      due: 'Apr 28', dueRel: 'paid Apr 28', daysLeft: 0, status: 'paid',
      borrowed: 'Apr 21', days: 7, avatar: 'GW', color: 'violet' },

    { id: 'L240210', name: 'Boss L.', principal: 3500, rate: 6, interest: 210, total: 3710,
      due: 'Apr 17', dueRel: 'default',  daysLeft: -25, status: 'default',
      borrowed: 'Apr 10', days: 7, avatar: 'BL', color: 'stone' },
  ];

  const monthly = [
    { m: 'Dec', interest: 840,  loans: 8 },
    { m: 'Jan', interest: 920,  loans: 9 },
    { m: 'Feb', interest: 1080, loans: 10 },
    { m: 'Mar', interest: 1320, loans: 12 },
    { m: 'Apr', interest: 1240, loans: 11 },
    { m: 'May', interest: 670,  loans: 7 },
  ];

  // Currency formatters. THB has no fractional baht in practice for this app.
  const fmt = (n) => '฿' + Math.round(n).toLocaleString('en-US');
  const fmtPlain = (n) => Math.round(n).toLocaleString('en-US');
  const fmtSign = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));

  return { summary, loans, monthly, fmt, fmtPlain, fmtSign };
})();
