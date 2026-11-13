/* global React */
// Direction D — "Pocket Bank"
// Direction B's dashboard layout (sidebar · KPI strip · chart · dense table · right rail)
// rendered in Direction C's warm, friendly visual language — cream paper, soft
// rounded cards, pastel accents, Hanken Grotesk.

const D_T = {
  bg:       '#f7f1e3',  // page cream
  surface:  '#ffffff',  // cards
  surface2: '#fbf6ec',  // softer wells
  ink:      '#1b1f2a',
  ink2:     '#3a4254',
  mute:     '#7a8298',
  mute2:    '#aab1bd',
  line:     '#ece3cf',
  line2:    '#f3eada',
  mint:     '#a8d8b9',
  mintDeep: '#2f7a5a',
  butter:   '#fae28d',
  butterDeep:'#9a7a14',
  blush:    '#f6c3b1',
  blushDeep:'#a04a2c',
  lavender: '#cdc6f0',
  lavDeep:  '#3d3680',
};

const d_font = {
  sans: '"Hanken Grotesk", "IBM Plex Sans Thai", "Plus Jakarta Sans", system-ui, sans-serif',
  mono: '"DM Mono", "JetBrains Mono", ui-monospace, monospace',
};

// ─── i18n ────────────────────────────────────────────────────────
const D_STR = {
  en: {
    brand: 'Pocket Bank', tagline: 'your tiny lending desk',
    nav: { overview: 'Overview', loans: 'Loans', borrowers: 'Borrowers', cash: 'Cash flow', reports: 'Reports' },
    synced: 'Synced', syncedSub: 'Pulled 2 min ago from your Sheets ledger.',
    today: 'Tuesday · May 12 2026',
    greeting: 'Hey Kit,', greetSub: 'one collection today.',
    withdraw: 'Withdraw', lend: '+ Lend money',
    kpi: { total: 'Total portfolio', profit: 'Net profit', npl: 'NPL ratio', free: 'Available cash' },
    kpiHint: { vsApr: 'vs Apr', lifetime: 'lifetime', oneDefault: '1 default' },
    interest6m: 'Interest earned · last 6 months',
    tabsAll: 'All', tabsToday: 'Today', tabsLate: 'Late', tabsRenewed: 'Renewed', tabsPaid: 'Paid',
    search: '⌘K search',
    th: { id: 'ID', borrower: 'Borrower', principal: 'Principal', interest: 'Interest', rate: 'Rate', due: 'Due', status: 'Status' },
    rail: { today: 'Today', overdue: 'Overdue', alloc: 'Where the money is',
            free: 'Free to lend', earning: 'Out earning', stuck: 'Stuck (default)' },
    paid: 'Got paid', renew: 'Renew',
    days7: '5,000 + ฿250 interest · 7 days', late3: '3,000 + ฿120 · was due May 9', lateChip: '3d late',
    quote: '"Lending is patience with a number on it."',
    // Modal
    newLoan: 'New loan', lendTo: 'Lend to someone',
    threeDetails: "Three details. Pocket figures out the interest and due date for you.",
    whoBorrowing: "Who's borrowing", pickType: '↓ pick or type new', newSm: '+ new',
    forHowLong: 'For how long', days: 'days', perLoan: 'per loan period',
    interestRate: 'Interest rate',
    transactionDate: 'Start date', dateToday: 'Today · May 12',
    howLook: "Here's how it'll look",
    youGive: 'You give', oweBack: 'They owe back', dueLabel: 'Due',
    cancel: 'Cancel', handOver: 'Hand Jane ฿4,000 →',
    // Mobile
    mHi: 'Hey Kit', allLoans: 'All loans', allLoansSub: '7 active ›',
    free2: 'Free', npl2: 'NPL',
    collectToday: 'Collect today', oneDue: '1 due', markPaid: 'Mark paid',
    noOverdueTitle: 'No overdue · nice', noOverdueSub: 'Everyone is on schedule. Keep going.',
    tabs: { home: 'Home', loans: 'Loans', reports: 'Reports', you: 'You' },
    // Detail
    detailSub: '4 loans previously · all paid on time',
    theyOwe: 'They owe you', onTrack: 'On track', dueIn: 'due May 18 · in 6 days',
    penalty: 'Penalty', total: 'Total', timeline: 'Timeline',
    tlBorrowed: 'Borrowed', tlReminder: 'Reminder', tlDueBack: 'Due back', tlSettle: 'Settle',
    tlBorrowedSub: '฿7,500 handed over · 14 days',
    tlReminderSub: 'Auto-nudge sent at 9am',
    tlDueSub: '฿7,875 expected',
    tlSettleSub: 'Mark paid · renew · default',
    gotPaid: 'Got paid ฿7,875', renewLong: 'Renew for another period', markBad: 'Mark as bad debt',
  },
  th: {
    brand: 'พ็อกเก็ต แบงก์', tagline: 'โต๊ะปล่อยกู้เล็กๆ ของคุณ',
    nav: { overview: 'ภาพรวม', loans: 'สินเชื่อ', borrowers: 'ผู้กู้', cash: 'กระแสเงินสด', reports: 'รายงาน' },
    synced: 'ซิงค์แล้ว', syncedSub: 'ดึงจาก Sheets เมื่อ 2 นาทีที่แล้ว',
    today: 'อังคาร · 12 พ.ค. 2569',
    greeting: 'สวัสดี คิต,', greetSub: 'มีเก็บหนี้ 1 รายวันนี้',
    withdraw: 'ถอนเงิน', lend: '+ ปล่อยกู้',
    kpi: { total: 'พอร์ตรวม', profit: 'กำไรสุทธิ', npl: 'หนี้เสีย', free: 'เงินสดว่าง' },
    kpiHint: { vsApr: 'เทียบ เม.ย.', lifetime: 'ทั้งหมด', oneDefault: 'เสีย 1 ราย' },
    interest6m: 'ดอกเบี้ยที่ได้รับ · 6 เดือนล่าสุด',
    tabsAll: 'ทั้งหมด', tabsToday: 'วันนี้', tabsLate: 'ค้างชำระ', tabsRenewed: 'ต่อสัญญา', tabsPaid: 'จ่ายแล้ว',
    search: '⌘K ค้นหา',
    th: { id: 'รหัส', borrower: 'ผู้กู้', principal: 'เงินต้น', interest: 'ดอกเบี้ย', rate: 'อัตรา', due: 'กำหนด', status: 'สถานะ' },
    rail: { today: 'วันนี้', overdue: 'ค้างชำระ', alloc: 'เงินอยู่ที่ไหน',
            free: 'พร้อมปล่อย', earning: 'กำลังทำงาน', stuck: 'หนี้เสีย' },
    paid: 'รับเงินแล้ว', renew: 'ต่อสัญญา',
    days7: '5,000 + ดอก ฿250 · 7 วัน', late3: '3,000 + ฿120 · กำหนด 9 พ.ค.', lateChip: 'ช้า 3 วัน',
    quote: '"การปล่อยกู้คือความอดทนที่มีตัวเลขกำกับ"',
    newLoan: 'สินเชื่อใหม่', lendTo: 'ปล่อยกู้ให้ใคร',
    threeDetails: 'แค่ 3 ช่อง พ็อกเก็ตจะคำนวณดอกและกำหนดจ่ายให้',
    whoBorrowing: 'ใครจะกู้', pickType: '↓ เลือกหรือพิมพ์ใหม่', newSm: '+ ใหม่',
    forHowLong: 'นานเท่าไหร่', days: 'วัน', perLoan: 'ต่อรอบสัญญา',
    interestRate: 'อัตราดอกเบี้ย',
    transactionDate: 'วันที่เริ่ม', dateToday: 'วันนี้ · 12 พ.ค.',
    howLook: 'หน้าตาจะเป็นแบบนี้',
    youGive: 'คุณให้', oweBack: 'เขาคืน', dueLabel: 'กำหนด',
    cancel: 'ยกเลิก', handOver: 'ส่งให้เจน ฿4,000 →',
    mHi: 'สวัสดี คิต', allLoans: 'สินเชื่อทั้งหมด', allLoansSub: '7 รายการ ›',
    free2: 'ว่าง', npl2: 'หนี้เสีย',
    collectToday: 'เก็บวันนี้', oneDue: '1 ราย', markPaid: 'รับแล้ว',
    noOverdueTitle: 'ไม่มีค้างชำระ · เยี่ยม', noOverdueSub: 'ทุกคนตรงเวลา เก่งมาก',
    tabs: { home: 'หน้าหลัก', loans: 'สินเชื่อ', reports: 'รายงาน', you: 'คุณ' },
    detailSub: 'กู้มาก่อน 4 ครั้ง · จ่ายตรงทุกครั้ง',
    theyOwe: 'เขาเป็นหนี้คุณ', onTrack: 'ตามแผน', dueIn: 'กำหนด 18 พ.ค. · อีก 6 วัน',
    penalty: 'ค่าปรับ', total: 'รวม', timeline: 'ไทม์ไลน์',
    tlBorrowed: 'ปล่อยกู้', tlReminder: 'เตือน', tlDueBack: 'กำหนดคืน', tlSettle: 'ปิดบัญชี',
    tlBorrowedSub: 'ส่ง ฿7,500 · 14 วัน',
    tlReminderSub: 'เตือนอัตโนมัติ 9 โมงเช้า',
    tlDueSub: 'คาดว่า ฿7,875',
    tlSettleSub: 'รับแล้ว · ต่อสัญญา · หนี้เสีย',
    gotPaid: 'รับเงินแล้ว ฿7,875', renewLong: 'ต่อสัญญาอีกรอบ', markBad: 'บันทึกเป็นหนี้เสีย',
  },
};
const L = () => D_STR[window.LANG || 'en'] || D_STR.en;

function DChip({ children, tone = 'mint' }) {
  const map = {
    mint:   [D_T.mint,   D_T.mintDeep],
    butter: [D_T.butter, D_T.butterDeep],
    blush:  [D_T.blush,  D_T.blushDeep],
    lav:    [D_T.lavender, D_T.lavDeep],
    ghost:  ['rgba(27,31,42,.06)', D_T.ink2],
  };
  const [bg, fg] = map[tone];
  return (
    <span style={{ padding: '3px 9px', borderRadius: 999, background: bg, color: fg,
                   fontSize: 10.5, fontWeight: 700, letterSpacing: '.02em',
                   textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

const dStatus = {
  'overdue':   ['blush',  'Overdue'],
  'due-today': ['butter', 'Today'],
  'active':    ['ghost',  'On track'],
  'renewed':   ['lav',    'Renewed'],
  'paid':      ['mint',   'Paid'],
  'default':   ['blush',  'Bad debt'],
};

function DAreaChart({ data, w = 680, h = 170 }) {
  const max = Math.max(...data.map(d => d.interest));
  const stepX = w / (data.length - 1);
  const pts = data.map((d, i) => [i * stepX, h - (d.interest / max) * (h - 24) - 12]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const fillPath = path + ` L ${w},${h} L 0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="d-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={D_T.mintDeep} stopOpacity="0.35" />
          <stop offset="100%" stopColor={D_T.mintDeep} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1="0" y1={h * p} x2={w} y2={h * p} stroke={D_T.line} strokeDasharray="2 5" />
      ))}
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
}

function DKpi({ label, value, delta, deltaPos, hint }) {
  return (
    <div style={{ padding: '20px 24px', borderRight: `1px solid ${D_T.line}`,
                  display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                    letterSpacing: '.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: D_T.ink,
                    letterSpacing: '-.025em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </div>
      {delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DChip tone={deltaPos ? 'mint' : 'blush'}>{deltaPos ? '↗' : '↘'} {delta}</DChip>
          {hint && <span style={{ fontSize: 11, color: D_T.mute }}>{hint}</span>}
        </div>
      )}
    </div>
  );
}

function DRow({ l, S }) {
  const [tone, text] = dStatus[l.status];
  return (
    <tr style={{ borderBottom: `1px solid ${D_T.line2}` }}>
      <td style={{ padding: '14px 12px', fontFamily: d_font.mono, fontSize: 11, color: D_T.mute2 }}>
        {l.id}
      </td>
      <td style={{ padding: '14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: D_T.surface2,
                        border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                        fontSize: 11, color: D_T.ink, fontWeight: 700 }}>
            {l.avatar}
          </div>
          <span style={{ fontSize: 13.5, color: D_T.ink, fontWeight: 600 }}>
            {l.name}
          </span>
        </div>
      </td>
      <td style={{ padding: '14px 8px', fontFamily: d_font.mono, fontSize: 12,
                   color: D_T.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {S.fmt(l.principal)}
      </td>
      <td style={{ padding: '14px 8px', fontFamily: d_font.mono, fontSize: 12,
                   color: D_T.mintDeep, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        +฿{l.interest}
      </td>
      <td style={{ padding: '14px 8px', fontFamily: d_font.mono, fontSize: 12,
                   color: D_T.ink2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {l.rate}.0%
      </td>
      <td style={{ padding: '14px 8px', fontSize: 12,
                   color: D_T.ink2, textAlign: 'right' }}>
        {l.due}
      </td>
      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
        <DChip tone={tone}>{text}</DChip>
      </td>
    </tr>
  );
}

function DPocketBankDesktop() {
  const S = window.SEED, s = S.summary; const l = L();
  return (
    <div style={{ width: 1280, height: 820, background: D_T.bg, color: D_T.ink,
                  fontFamily: d_font.sans, display: 'flex', boxSizing: 'border-box' }}>
      {/* Sidebar */}
      <aside style={{ width: 224, padding: '24px 16px', display: 'flex',
                      flexDirection: 'column', gap: 4, background: D_T.surface2,
                      borderRight: `1px solid ${D_T.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px',
                      borderBottom: `1px solid ${D_T.line}`, marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: D_T.ink,
                        color: D_T.butter, display: 'grid', placeItems: 'center',
                        fontSize: 14, fontWeight: 800 }}>P</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.02em' }}>{l.brand}</div>
            <div style={{ fontSize: 10, color: D_T.mute }}>{l.tagline}</div>
          </div>
        </div>
        {[
          [l.nav.overview, true, '◉'],
          [l.nav.loans, false, '◇', 8],
          [l.nav.borrowers, false, '○'],
          [l.nav.cash, false, '◐'],
          [l.nav.reports, false, '◑'],
        ].map(([label, active, icon, badge]) => (
          <div key={label} style={{ padding: '10px 12px', borderRadius: 12,
                                     background: active ? D_T.surface : 'transparent',
                                     color: active ? D_T.ink : D_T.ink2,
                                     fontSize: 13, fontWeight: active ? 700 : 500,
                                     display: 'flex', alignItems: 'center', gap: 10,
                                     boxShadow: active ? '0 1px 0 rgba(27,31,42,.04)' : 'none' }}>
            <span style={{ width: 16, color: active ? D_T.mintDeep : D_T.mute2 }}>{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {badge && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999,
                              background: D_T.bg, color: D_T.mute, fontWeight: 700 }}>{badge}</span>
            )}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: 14, borderRadius: 14, background: D_T.surface,
                       border: `1px solid ${D_T.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: D_T.mintDeep }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{l.synced}</span>
          </div>
          <div style={{ fontSize: 11, color: D_T.mute, lineHeight: 1.5 }}>
            {l.syncedSub}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                         padding: '20px 28px', borderBottom: `1px solid ${D_T.line}`,
                         background: D_T.bg }}>
          <div>
            <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                          letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              {l.today}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>
              {l.greeting} <span style={{ color: D_T.mute }}>{l.greetSub}</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '9px 16px', borderRadius: 999, background: D_T.surface,
                              color: D_T.ink, border: `1px solid ${D_T.line}`,
                              fontFamily: d_font.sans, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              {l.withdraw}
            </button>
            <button style={{ padding: '9px 18px', borderRadius: 999, background: D_T.ink,
                              color: D_T.bg, border: 'none',
                              fontFamily: d_font.sans, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              {l.lend}
            </button>
          </div>
        </header>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                       borderBottom: `1px solid ${D_T.line}`, background: D_T.surface }}>
          <DKpi label={l.kpi.total} value={S.fmt(s.totalLimit)} delta="+8.0%" deltaPos hint={l.kpiHint.vsApr} />
          <DKpi label={l.kpi.profit} value={S.fmtSign(s.netProfit)} delta="+14.8%" deltaPos hint={l.kpiHint.lifetime} />
          <DKpi label={l.kpi.npl} value={s.nplRatio.toFixed(1) + '%'} delta="−0.4 pts" deltaPos={false} hint={l.kpiHint.oneDefault} />
          <DKpi label={l.kpi.free} value={S.fmt(s.available)} delta="−12.0%" deltaPos={false} hint={l.kpiHint.vsApr} />
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>
          <section style={{ padding: '22px 28px', overflow: 'auto' }}>
            {/* Chart */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                            borderRadius: 18, padding: '20px 22px 18px', marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                              marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                                  letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {l.interest6m}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em',
                                    fontVariantNumeric: 'tabular-nums' }}>
                      {S.fmt(s.monthInterest)}
                    </span>
                    <DChip tone="mint">↗ 14.8%</DChip>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, padding: 3,
                               background: D_T.surface2, borderRadius: 999 }}>
                  {['1M', '3M', '6M', '1Y', 'All'].map(p => (
                    <span key={p} style={{ padding: '5px 12px', borderRadius: 999,
                                             background: p === '6M' ? D_T.ink : 'transparent',
                                             color: p === '6M' ? D_T.bg : D_T.ink2,
                                             fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <DAreaChart data={S.monthly} w={680} h={150} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6,
                              fontFamily: d_font.mono, fontSize: 10, color: D_T.mute2, width: 680 }}>
                {S.monthly.map(m => <span key={m.m}>{m.m}</span>)}
              </div>
            </div>

            {/* Table */}
            <div style={{ background: D_T.surface, border: `1px solid ${D_T.line}`,
                            borderRadius: 18, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[[l.tabsAll, 7, true], [l.tabsToday, 1, false], [l.tabsLate, 1, false],
                    [l.tabsRenewed, 1, false], [l.tabsPaid, 2, false]].map(([t, n, on]) => (
                    <span key={t} style={{ padding: '6px 12px', borderRadius: 999,
                                              background: on ? D_T.ink : D_T.surface2,
                                              color: on ? D_T.bg : D_T.ink2,
                                              fontSize: 11.5, fontWeight: 700,
                                              display: 'inline-flex', alignItems: 'center', gap: 6,
                                              cursor: 'pointer' }}>
                      {t}
                      <span style={{ fontSize: 10, opacity: 0.7 }}>{n}</span>
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: D_T.mute2, fontFamily: d_font.mono }}>{l.search}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${D_T.line}` }}>
                    {[l.th.id, l.th.borrower, l.th.principal, l.th.interest, l.th.rate, l.th.due, l.th.status].map((h, i) => (
                      <th key={h} style={{ padding: '8px 8px', textAlign: i >= 2 && i <= 5 ? 'right' : i === 6 ? 'right' : 'left',
                                            fontSize: 10, color: D_T.mute2, fontWeight: 700,
                                            letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {S.loans.slice(0, 6).map(l => <DRow key={l.id} l={l} S={S} />)}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right rail */}
          <aside style={{ borderLeft: `1px solid ${D_T.line}`, padding: '22px 24px',
                            background: D_T.bg, display: 'flex', flexDirection: 'column', gap: 18,
                            overflow: 'auto' }}>
            {/* Today */}
            <div>
              <div style={{ fontSize: 11, color: D_T.butterDeep, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                {l.rail.today}
              </div>
              <div style={{ padding: 18, borderRadius: 18, background: D_T.butter,
                              boxShadow: '0 1px 0 rgba(27,31,42,.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>Aom S.</span>
                  <DChip tone="ghost">L240312</DChip>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.025em',
                                fontVariantNumeric: 'tabular-nums' }}>
                  ฿5,250
                </div>
                <div style={{ fontSize: 11, color: D_T.ink2, marginTop: 2 }}>
                  ฿{l.days7}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                  <button style={{ flex: 1, padding: '8px 0', background: D_T.ink, color: D_T.bg,
                                    border: 'none', borderRadius: 999,
                                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                                    fontFamily: d_font.sans }}>{l.paid}</button>
                  <button style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,.6)',
                                    color: D_T.ink, border: 'none', borderRadius: 999,
                                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                                    fontFamily: d_font.sans }}>{l.renew}</button>
                </div>
              </div>
            </div>

            {/* Overdue */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                              marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: D_T.blushDeep, fontWeight: 700,
                                  letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {l.rail.overdue} · 1
                </span>
                <span style={{ fontSize: 11, color: D_T.blushDeep, fontWeight: 700,
                                  fontFamily: d_font.mono }}>−฿3,120</span>
              </div>
              <div style={{ padding: 14, borderRadius: 14, background: D_T.blush }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Bank P.</span>
                  <span style={{ fontSize: 11, color: D_T.blushDeep, fontWeight: 700 }}>{l.lateChip}</span>
                </div>
                <div style={{ fontSize: 11, color: D_T.ink2 }}>
                  ฿{l.late3}
                </div>
              </div>
            </div>

            {/* Allocation */}
            <div>
              <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                {l.rail.alloc}
              </div>
              {[
                [l.rail.earning,  s.deployed,  D_T.mintDeep,  75],
                [l.rail.free, s.available, D_T.butterDeep, 25],
                [l.rail.stuck, 3500,     D_T.blushDeep, 11],
              ].map(([label, val, color, pct]) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                  fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: D_T.ink2, fontWeight: 600 }}>{label}</span>
                    <span style={{ color: D_T.ink, fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums' }}>{S.fmt(val)}</span>
                  </div>
                  <div style={{ height: 6, background: D_T.surface2, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', fontSize: 11, color: D_T.mute2, fontStyle: 'italic',
                            lineHeight: 1.5 }}>
              {l.quote}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── D · Mobile ──────────────────────────────────────────────────
function DPocketBankMobile() {
  const S = window.SEED, s = S.summary;
  return (
    <div style={{ width: 390, height: 760, background: D_T.bg, color: D_T.ink,
                   fontFamily: d_font.sans, boxSizing: 'border-box', overflow: 'hidden',
                   display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 38, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                     padding: '0 24px', fontSize: 13, fontWeight: 700 }}>
        <span>9:41</span>
        <div style={{ width: 110, height: 28, borderRadius: 14, background: '#000' }} />
        <span style={{ fontSize: 11 }}>●●● ◐</span>
      </div>

      <div style={{ padding: '10px 22px 6px', display: 'flex', justifyContent: 'space-between',
                     alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: D_T.ink,
                          color: D_T.butter, display: 'grid', placeItems: 'center',
                          fontSize: 14, fontWeight: 800 }}>P</div>
          <div>
            <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700,
                           letterSpacing: '.08em', textTransform: 'uppercase' }}>Pocket Bank</div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.02em' }}>Hey Kit</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: D_T.surface,
                         border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                         fontSize: 14 }}>⌕</div>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: D_T.surface,
                         border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                         fontSize: 14, position: 'relative' }}>
            ◔
            <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7,
                            borderRadius: 99, background: D_T.blushDeep }} />
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '8px 18px 12px' }}>
        <div style={{ padding: 20, borderRadius: 22, background: D_T.surface,
                        border: `1px solid ${D_T.line}` }}>
          <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                          letterSpacing: '.06em', textTransform: 'uppercase' }}>Total portfolio</div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.025em', marginTop: 4,
                          lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {S.fmt(s.totalLimit)}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <DChip tone="mint">↗ {S.fmtSign(s.netProfit)}</DChip>
            <span style={{ fontSize: 11, color: D_T.mute }}>+{s.profitPct.toFixed(1)}% lifetime</span>
          </div>
          {/* Mini chart */}
          <div style={{ marginTop: 14, marginLeft: -4, marginRight: -4 }}>
            <DAreaChart data={S.monthly} w={310} h={70} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <div style={{ padding: 12, borderRadius: 12, background: D_T.surface2 }}>
              <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>Free</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2,
                              fontVariantNumeric: 'tabular-nums' }}>{S.fmt(s.available)}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: D_T.surface2 }}>
              <div style={{ fontSize: 10, color: D_T.mute, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>NPL</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: D_T.blushDeep,
                              fontVariantNumeric: 'tabular-nums' }}>{s.nplRatio.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Today */}
      <div style={{ padding: '4px 18px' }}>
        <div style={{ padding: 16, borderRadius: 18, background: D_T.butter }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                          marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: D_T.butterDeep, fontWeight: 800,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>Collect today</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.025em', marginTop: 2 }}>
                ฿5,250
              </div>
            </div>
            <DChip tone="ghost">1 due</DChip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                          background: 'rgba(255,255,255,.6)', borderRadius: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: D_T.ink,
                            color: D_T.butter, display: 'grid', placeItems: 'center',
                            fontSize: 12, fontWeight: 800 }}>AS</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Aom S.</div>
              <div style={{ fontSize: 10.5, color: D_T.ink2 }}>฿5,000 + ฿250 · L240312</div>
            </div>
            <button style={{ padding: '7px 12px', borderRadius: 999, background: D_T.ink,
                              color: D_T.bg, border: 'none', fontSize: 11, fontWeight: 700,
                              fontFamily: d_font.sans }}>Mark paid</button>
          </div>
        </div>
      </div>

      {/* Loans list */}
      <div style={{ flex: 1, padding: '12px 18px 4px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                       marginBottom: 8, padding: '0 2px' }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>All loans</span>
          <span style={{ fontSize: 11, color: D_T.mute }}>7 active ›</span>
        </div>
        {S.loans.slice(1, 4).map(l => {
          const [tone, text] = dStatus[l.status];
          return (
            <div key={l.id} style={{ background: D_T.surface, borderRadius: 14, padding: 12,
                                       marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10,
                                       border: `1px solid ${D_T.line2}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: D_T.surface2,
                              border: `1px solid ${D_T.line}`, display: 'grid', placeItems: 'center',
                              fontSize: 11, fontWeight: 800 }}>{l.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</span>
                  <DChip tone={tone}>{text}</DChip>
                </div>
                <div style={{ fontSize: 10.5, color: D_T.mute, marginTop: 2 }}>
                  {l.dueRel} · ฿{l.interest} interest
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em',
                              fontVariantNumeric: 'tabular-nums' }}>{S.fmt(l.total)}</div>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <nav style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                     padding: '10px 16px 22px', borderTop: `1px solid ${D_T.line}`,
                     background: D_T.surface }}>
        {[['Home', '◉', true], ['Loans', '◇', false], ['+', '+', false, true],
          ['Reports', '◐', false], ['You', '○', false]].map(([l, ic, active, primary]) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: primary ? 44 : 26, height: primary ? 44 : 26,
                           borderRadius: primary ? 14 : 0,
                           background: primary ? D_T.ink : 'transparent',
                           color: primary ? D_T.butter : active ? D_T.mintDeep : D_T.mute2,
                           display: 'grid', placeItems: 'center',
                           fontSize: primary ? 22 : 16, fontWeight: 800 }}>
              {ic}
            </div>
            {!primary && (
              <span style={{ fontSize: 9.5, color: active ? D_T.ink : D_T.mute2,
                              fontWeight: 700, letterSpacing: '.04em' }}>{l}</span>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}

// ─── D · New Loan sheet (desktop modal) ──────────────────────────
function DNewLoanModal() {
  const l = L();
  return (
    <div style={{ width: 1280, height: 820, background: 'rgba(27,31,42,.45)',
                   fontFamily: d_font.sans, color: D_T.ink,
                   display: 'grid', placeItems: 'center',
                   position: 'relative', overflow: 'hidden' }}>
      {/* Blurred dashboard hint behind */}
      <div style={{ position: 'absolute', inset: 0, background: D_T.bg, opacity: 0.6,
                     backgroundImage: `radial-gradient(circle at 20% 30%, ${D_T.butter}30, transparent 50%),
                                       radial-gradient(circle at 80% 70%, ${D_T.mint}30, transparent 50%)` }} />
      <div style={{ width: 560, background: D_T.surface, borderRadius: 24, overflow: 'hidden',
                     boxShadow: '0 24px 60px -20px rgba(27,31,42,.35), 0 8px 24px rgba(27,31,42,.12)',
                     position: 'relative' }}>
        {/* Header */}
        <div style={{ padding: '22px 26px 18px', borderBottom: `1px solid ${D_T.line}`,
                        background: D_T.surface2, display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>{l.newLoan}</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4,
                            color: D_T.ink }}>
              {l.lendTo}
            </div>
            <div style={{ fontSize: 12, color: D_T.mute, marginTop: 4 }}>
              {l.threeDetails}
            </div>
          </div>
          <button style={{ width: 30, height: 30, borderRadius: 99, border: 'none',
                            background: 'rgba(27,31,42,.06)', color: D_T.ink, fontSize: 14,
                            cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 26px 14px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>{l.whoBorrowing}</label>
            <div style={{ marginTop: 8, padding: '12px 14px', border: `1.5px solid ${D_T.ink}`,
                            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                            background: D_T.surface }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: D_T.butter,
                              color: D_T.ink, display: 'grid', placeItems: 'center',
                              fontSize: 12, fontWeight: 800 }}>JR</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: D_T.ink }}>Jane R.</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: D_T.mute }}>{l.pickType}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {['Mint K.', 'Boss L.', 'Nine T.', l.newSm].map((n, i) => (
                <span key={n} style={{ padding: '5px 10px', borderRadius: 999,
                                          background: D_T.surface2, fontSize: 11, fontWeight: 600,
                                          color: i === 3 ? D_T.mintDeep : D_T.ink2,
                                          border: `1px solid ${D_T.line}` }}>
                  {n}
                </span>
              ))}
            </div>
          </div>

          {/* Amount + days */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                                letterSpacing: '.06em', textTransform: 'uppercase' }}>{l.th.principal}</label>
              <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 12,
                              background: D_T.surface2, border: `1px solid ${D_T.line}`,
                              display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: D_T.ink }}>฿</span>
                <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em',
                                 marginLeft: 4, color: D_T.ink,
                                 fontVariantNumeric: 'tabular-nums' }}>2,000</span>
                <span style={{ marginLeft: 'auto', display: 'inline-block', width: 1.5, height: 22,
                                 background: D_T.ink, animation: 'blink 1s infinite' }} />
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                {['500', '1k', '1.5k', '2k', '2.5k', '3k'].map((p, i) => (
                  <span key={p} style={{ padding: '5px 9px', borderRadius: 999,
                                            background: i === 3 ? D_T.ink : D_T.surface2,
                                            color: i === 3 ? D_T.bg : D_T.ink2,
                                            fontSize: 11, fontWeight: 700,
                                            border: i === 3 ? 'none' : `1px solid ${D_T.line}` }}>{p}</span>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                                letterSpacing: '.06em', textTransform: 'uppercase' }}>{l.forHowLong}</label>
              <div style={{ marginTop: 8, padding: '8px 8px 8px 14px', borderRadius: 12,
                              background: D_T.surface2, border: `1px solid ${D_T.line}`,
                              display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em',
                                 color: D_T.ink,
                                 fontVariantNumeric: 'tabular-nums' }}>5</span>
                <span style={{ fontSize: 14, color: D_T.mute, flex: 1 }}>{l.days}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${D_T.line}`,
                                     background: D_T.surface, color: D_T.ink, fontSize: 16,
                                     fontWeight: 700, fontFamily: d_font.sans, cursor: 'pointer',
                                     display: 'grid', placeItems: 'center', lineHeight: 1 }}>−</button>
                  <button style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${D_T.line}`,
                                     background: D_T.surface, color: D_T.ink, fontSize: 16,
                                     fontWeight: 700, fontFamily: d_font.sans, cursor: 'pointer',
                                     display: 'grid', placeItems: 'center', lineHeight: 1 }}>+</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {['3', '5', '7'].map((p, i) => (
                  <span key={p} style={{ padding: '5px 12px', borderRadius: 999,
                                            background: i === 1 ? D_T.ink : D_T.surface2,
                                            color: i === 1 ? D_T.bg : D_T.ink2,
                                            fontSize: 11, fontWeight: 700,
                                            border: i === 1 ? 'none' : `1px solid ${D_T.line}` }}>{p}d</span>
                ))}
              </div>
            </div>
          </div>

          {/* Start date */}
          <div>
            <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                              letterSpacing: '.06em', textTransform: 'uppercase' }}>{l.transactionDate}</label>
            <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 12,
                            background: D_T.surface2, border: `1px solid ${D_T.line}`,
                            display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: D_T.lavender,
                              color: D_T.lavDeep, display: 'grid', placeItems: 'center',
                              fontSize: 14, fontWeight: 800 }}>12</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: D_T.ink }}>{l.dateToday}</div>
                <div style={{ fontSize: 11, color: D_T.mute, marginTop: 1 }}>
                  {l.dueLabel}: 17 · 5 {l.days}
                </div>
              </div>
              <button style={{ padding: '8px 12px', borderRadius: 999, background: D_T.surface,
                                border: `1px solid ${D_T.line}`, fontSize: 11.5, fontWeight: 700,
                                color: D_T.ink, fontFamily: d_font.sans, cursor: 'pointer' }}>▣ ☰</button>
            </div>
          </div>

          {/* Rate */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                                letterSpacing: '.06em', textTransform: 'uppercase' }}>{l.interestRate}</label>
              <span style={{ fontSize: 12, color: D_T.mute }}>{l.perLoan}</span>
            </div>
            <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 12,
                            background: D_T.mint, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>5.0%</span>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.5)', borderRadius: 99,
                              position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%',
                                background: D_T.mintDeep, borderRadius: 99 }} />
                <div style={{ position: 'absolute', left: '50%', top: '50%',
                                transform: 'translate(-50%,-50%)', width: 16, height: 16,
                                borderRadius: 99, background: D_T.ink,
                                boxShadow: '0 2px 6px rgba(0,0,0,.25)' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: D_T.mintDeep }}>≈ ฿200</span>
            </div>
          </div>

          {/* Preview */}
          <div style={{ padding: 16, borderRadius: 14, background: D_T.surface2,
                          border: `1px dashed ${D_T.line}` }}>
            <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                            letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              {l.howLook}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                [l.youGive, '฿4,000', D_T.ink],
                [l.oweBack, '฿4,200', D_T.ink],
                [l.dueLabel, 'May 26', D_T.mintDeep],
              ].map(([lbl, v, c]) => (
                <div key={lbl}>
                  <div style={{ fontSize: 10.5, color: D_T.mute, fontWeight: 600 }}>{lbl}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c, marginTop: 4,
                                  letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 26px 22px', display: 'flex', gap: 10,
                        borderTop: `1px solid ${D_T.line}`, background: D_T.surface2 }}>
          <button style={{ padding: '12px 16px', borderRadius: 999, background: D_T.surface,
                            color: D_T.ink, border: `1px solid ${D_T.line}`,
                            fontSize: 13, fontWeight: 700, fontFamily: d_font.sans,
                            cursor: 'pointer' }}>{l.cancel}</button>
          <button style={{ flex: 1, padding: '12px 16px', borderRadius: 999, background: D_T.ink,
                            color: D_T.bg, border: 'none', fontSize: 13, fontWeight: 700,
                            fontFamily: d_font.sans, cursor: 'pointer' }}>
            {l.handOver}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── D · Loan detail drawer ──────────────────────────────────────
function DLoanDetail() {
  const S = window.SEED;
  const l = S.loans[2]; // Mint K., active
  return (
    <div style={{ width: 480, height: 820, background: D_T.surface, color: D_T.ink,
                   fontFamily: d_font.sans, boxSizing: 'border-box', overflow: 'hidden',
                   borderLeft: `1px solid ${D_T.line}`,
                   boxShadow: '-12px 0 30px -16px rgba(27,31,42,.18)',
                   display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${D_T.line}`,
                      background: D_T.surface2, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <DChip tone="ghost">{l.id}</DChip>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ width: 30, height: 30, borderRadius: 99, border: `1px solid ${D_T.line}`,
                              background: D_T.surface, fontSize: 12, cursor: 'pointer' }}>✎</button>
            <button style={{ width: 30, height: 30, borderRadius: 99, border: 'none',
                              background: 'rgba(27,31,42,.06)', fontSize: 14, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: D_T.lavender,
                          color: D_T.lavDeep, display: 'grid', placeItems: 'center',
                          fontSize: 19, fontWeight: 800 }}>{l.avatar}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>{l.name}</div>
            <div style={{ fontSize: 12, color: D_T.mute, marginTop: 2 }}>
              4 loans previously · all paid on time
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflow: 'auto' }}>
        {/* Big amount */}
        <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                       letterSpacing: '.06em', textTransform: 'uppercase' }}>They owe you</div>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-.025em', marginTop: 4,
                       lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {S.fmt(l.total)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <DChip tone="mint">On track</DChip>
          <span style={{ fontSize: 12, color: D_T.mute }}>due May 18 · in 6 days</span>
        </div>

        {/* Breakdown */}
        <div style={{ marginTop: 22, padding: 18, borderRadius: 16, background: D_T.surface2,
                       border: `1px solid ${D_T.line}` }}>
          {[
            ['Principal', S.fmt(l.principal), D_T.ink],
            ['Interest @ 5%', '+ ฿' + l.interest, D_T.mintDeep],
            ['Penalty', '฿0', D_T.mute],
          ].map(([k, v, c], i, arr) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                                    padding: '10px 0',
                                    borderBottom: i < arr.length - 1 ? `1px dashed ${D_T.line}` : 'none' }}>
              <span style={{ fontSize: 13, color: D_T.ink2, fontWeight: 600 }}>{k}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: c,
                              fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          marginTop: 12, paddingTop: 12, borderTop: `1.5px solid ${D_T.ink}` }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.04em',
                            textTransform: 'uppercase' }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {S.fmt(l.total)}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, color: D_T.mute, fontWeight: 700,
                          letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Timeline</div>
          {[
            ['May 4',  'Borrowed',  '฿7,500 handed over · 14 days', 'done'],
            ['May 11', 'Reminder',  'Auto-nudge sent at 9am',         'done'],
            ['May 18', 'Due back',  '฿7,875 expected',                'next'],
            ['—',      'Settle',    'Mark paid · renew · default',    'future'],
          ].map(([date, t, sub, state], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 14, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 6, top: 18, bottom: -4, width: 1.5,
                              background: i === 3 ? 'transparent' : D_T.line }} />
              <div style={{ width: 14, height: 14, borderRadius: 99,
                              background: state === 'done' ? D_T.mintDeep
                                       : state === 'next' ? D_T.butter
                                       : D_T.surface,
                              border: state === 'future' ? `1.5px dashed ${D_T.mute2}` : 'none',
                              flexShrink: 0, marginTop: 4, position: 'relative', zIndex: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700,
                                   color: state === 'future' ? D_T.mute : D_T.ink }}>{t}</span>
                  <span style={{ fontSize: 11, color: D_T.mute,
                                   fontFamily: d_font.mono }}>{date}</span>
                </div>
                <div style={{ fontSize: 11.5, color: D_T.mute, marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: 8,
                      borderTop: `1px solid ${D_T.line}`, background: D_T.surface }}>
        <button style={{ width: '100%', padding: '13px 0', borderRadius: 999, background: D_T.ink,
                          color: D_T.bg, border: 'none', fontSize: 14, fontWeight: 800,
                          fontFamily: d_font.sans, cursor: 'pointer' }}>
          Got paid ฿7,875
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ flex: 1, padding: '11px 0', borderRadius: 999, background: D_T.lavender,
                            color: D_T.lavDeep, border: 'none', fontSize: 12, fontWeight: 700,
                            fontFamily: d_font.sans, cursor: 'pointer' }}>Renew for another period</button>
          <button style={{ flex: 1, padding: '11px 0', borderRadius: 999, background: D_T.blush,
                            color: D_T.blushDeep, border: 'none', fontSize: 12, fontWeight: 700,
                            fontFamily: d_font.sans, cursor: 'pointer' }}>Mark as bad debt</button>
        </div>
      </div>
    </div>
  );
}

window.DPocketBankDesktop = DPocketBankDesktop;
window.DPocketBankMobile = DPocketBankMobile;
window.DNewLoanModal = DNewLoanModal;
window.DLoanDetail = DLoanDetail;
