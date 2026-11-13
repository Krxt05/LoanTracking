/* global React */
// Direction B — "Quiet Bank"
// Dark terminal-fintech. Tight Geist + Geist Mono, cyber-lime accent on graphite.
// Dense tables, micro-typography, no decoration without purpose.

const B_T = {
  bg:      '#0c0d10',
  surface: '#15171c',
  surface2:'#1c1f25',
  line:    '#262a32',
  line2:   '#33384200',
  text:    '#e7e8ec',
  mute:    '#8a8f9b',
  mute2:   '#5a606b',
  lime:    '#c9ff3a',
  limeDim: '#7a9a25',
  rose:    '#ff5471',
  amber:   '#ffb454',
  green:   '#5be39b',
};

const b_font = {
  sans: '"Geist", "Inter Tight", "Inter", system-ui, sans-serif',
  mono: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
};

function BPill({ children, tone = 'mute', solid }) {
  const toneMap = {
    mute: { bg: B_T.surface2, fg: B_T.mute },
    lime: { bg: B_T.lime, fg: '#0a0c10' },
    rose: { bg: 'rgba(255,84,113,.14)', fg: B_T.rose },
    amber:{ bg: 'rgba(255,180,84,.14)', fg: B_T.amber },
    green:{ bg: 'rgba(91,227,155,.14)', fg: B_T.green },
  };
  const t = toneMap[tone] || toneMap.mute;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                   padding: '2px 7px', borderRadius: 4, background: solid ? B_T.lime : t.bg,
                   color: solid ? '#0a0c10' : t.fg, fontFamily: b_font.mono, fontSize: 10,
                   letterSpacing: '.02em', fontWeight: 500, lineHeight: 1.4 }}>
      {children}
    </span>
  );
}

function BKpi({ label, value, delta, deltaPos = true, mono = true, large }) {
  return (
    <div style={{ padding: '18px 20px', borderRight: `1px solid ${B_T.line}` }}>
      <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute,
                    letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontFamily: mono ? b_font.mono : b_font.sans,
                    fontSize: large ? 32 : 26, fontWeight: 500, color: B_T.text,
                    letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1 }}>
        {value}
      </div>
      {delta != null && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: b_font.mono, fontSize: 11,
                         color: deltaPos ? B_T.green : B_T.rose }}>
            {deltaPos ? '↗' : '↘'} {delta}
          </span>
          <span style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute2 }}>vs Apr</span>
        </div>
      )}
    </div>
  );
}

function BAreaChart({ data, w = 720, h = 160 }) {
  const max = Math.max(...data.map(d => d.interest));
  const stepX = w / (data.length - 1);
  const pts = data.map((d, i) => [i * stepX, h - (d.interest / max) * (h - 20) - 10]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const fillPath = path + ` L ${w},${h} L 0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="b-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={B_T.lime} stopOpacity="0.22" />
          <stop offset="100%" stopColor={B_T.lime} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1="0" y1={h * p} x2={w} y2={h * p} stroke={B_T.line} strokeDasharray="2 4" />
      ))}
      <path d={fillPath} fill="url(#b-grad)" />
      <path d={path} fill="none" stroke={B_T.lime} strokeWidth="1.5" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 0} fill={B_T.lime} />
      ))}
    </svg>
  );
}

const bStatus = {
  'overdue':   { tone: 'rose',  text: 'OVERDUE' },
  'due-today': { tone: 'amber', text: 'DUE TODAY' },
  'active':    { tone: 'mute',  text: 'ACTIVE' },
  'renewed':   { tone: 'green', text: 'RENEWED' },
  'paid':      { tone: 'mute',  text: 'SETTLED' },
  'default':   { tone: 'rose',  text: 'DEFAULT' },
};

function BRow({ l, S }) {
  const st = bStatus[l.status];
  return (
    <tr style={{ borderBottom: `1px solid ${B_T.line}` }}>
      <td style={{ padding: '14px 16px', fontFamily: b_font.mono, fontSize: 11, color: B_T.mute2 }}>
        {l.id}
      </td>
      <td style={{ padding: '14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 4, background: B_T.surface2,
                        display: 'grid', placeItems: 'center', fontFamily: b_font.mono,
                        fontSize: 10, color: B_T.text, letterSpacing: '.02em' }}>
            {l.avatar}
          </div>
          <span style={{ fontFamily: b_font.sans, fontSize: 13, color: B_T.text, fontWeight: 500 }}>
            {l.name}
          </span>
        </div>
      </td>
      <td style={{ padding: '14px 8px', fontFamily: b_font.mono, fontSize: 12,
                   color: B_T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {S.fmtPlain(l.principal)}
      </td>
      <td style={{ padding: '14px 8px', fontFamily: b_font.mono, fontSize: 12,
                   color: B_T.mute, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        +{l.interest}
      </td>
      <td style={{ padding: '14px 8px', fontFamily: b_font.mono, fontSize: 12,
                   color: B_T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {l.rate}.0%
      </td>
      <td style={{ padding: '14px 8px', fontFamily: b_font.mono, fontSize: 12,
                   color: B_T.mute, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {l.due}
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
        <BPill tone={st.tone}>{st.text}</BPill>
      </td>
    </tr>
  );
}

// ─── B · Desktop ──────────────────────────────────────────────────
function BBankDesktop() {
  const S = window.SEED, s = S.summary;
  return (
    <div style={{ width: 1280, height: 820, background: B_T.bg, color: B_T.text,
                  fontFamily: b_font.sans, display: 'flex', boxSizing: 'border-box' }}>
      {/* Side nav */}
      <aside style={{ width: 220, borderRight: `1px solid ${B_T.line}`, padding: '24px 16px',
                      display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 18px',
                      borderBottom: `1px solid ${B_T.line}`, marginBottom: 16 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, background: B_T.lime,
                        display: 'grid', placeItems: 'center',
                        fontFamily: b_font.mono, fontSize: 12, color: '#0a0c10', fontWeight: 700 }}>
            ◢
          </div>
          <span style={{ fontFamily: b_font.sans, fontSize: 14, fontWeight: 500, letterSpacing: '-.01em' }}>
            principal<span style={{ color: B_T.mute2 }}>.</span>
          </span>
        </div>
        {[
          ['Overview', true], ['Loans', false], ['Borrowers', false],
          ['Cash flow', false], ['Reports', false],
        ].map(([label, active]) => (
          <div key={label} style={{ padding: '8px 10px', borderRadius: 4,
                                     background: active ? B_T.surface : 'transparent',
                                     color: active ? B_T.text : B_T.mute,
                                     fontSize: 13, fontWeight: active ? 500 : 400,
                                     display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span>
            {label === 'Loans' && <span style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute2 }}>8</span>}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: 12, borderRadius: 6, background: B_T.surface, fontSize: 11,
                       color: B_T.mute, lineHeight: 1.5 }}>
          <div style={{ color: B_T.text, fontWeight: 500, marginBottom: 4, fontSize: 12 }}>Synced</div>
          Last pull 2 min ago from Sheets ledger.
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                         padding: '20px 32px', borderBottom: `1px solid ${B_T.line}` }}>
          <div>
            <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute2,
                          letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              OVERVIEW · TUESDAY, MAY 12 2026
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: '-.02em' }}>
              Good evening. <span style={{ color: B_T.mute }}>One collection today.</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '8px 14px', background: 'transparent', color: B_T.text,
                              border: `1px solid ${B_T.line}`, borderRadius: 5,
                              fontFamily: b_font.sans, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Withdraw
            </button>
            <button style={{ padding: '8px 14px', background: B_T.lime, color: '#0a0c10',
                              border: 'none', borderRadius: 5,
                              fontFamily: b_font.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + New loan
            </button>
          </div>
        </header>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                       borderBottom: `1px solid ${B_T.line}` }}>
          <BKpi label="Total portfolio" value={S.fmt(s.totalLimit)} delta="+8.0%" deltaPos large />
          <BKpi label="Net profit" value={S.fmtSign(s.netProfit)} delta="+14.8%" deltaPos large />
          <BKpi label="NPL ratio" value={s.nplRatio.toFixed(1) + '%'} delta="−0.4 pts" deltaPos={false} large />
          <BKpi label="Available cash" value={S.fmt(s.available)} delta="−12.0%" deltaPos={false} large />
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>
          {/* Chart + table */}
          <section style={{ padding: '24px 32px', overflow: 'auto' }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                            marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute,
                                letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Interest earned · last 6 mo
                  </div>
                  <div style={{ fontFamily: b_font.mono, fontSize: 26, fontWeight: 500,
                                color: B_T.text, fontVariantNumeric: 'tabular-nums' }}>
                    {S.fmt(s.monthInterest)} <span style={{ fontSize: 13, color: B_T.green, marginLeft: 6 }}>↗ 14.8%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['1M', '3M', '6M', '1Y', 'All'].map(p => (
                    <span key={p} style={{ padding: '4px 10px', borderRadius: 4,
                                            background: p === '6M' ? B_T.surface : 'transparent',
                                            color: p === '6M' ? B_T.text : B_T.mute,
                                            fontFamily: b_font.mono, fontSize: 11, cursor: 'pointer' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <BAreaChart data={S.monthly} w={680} h={160} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8,
                            fontFamily: b_font.mono, fontSize: 10, color: B_T.mute2, width: 680 }}>
                {S.monthly.map(m => <span key={m.m}>{m.m}</span>)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Open positions</span>
                {['All 7', 'Renewed 1', 'Settled 2', 'Default 1'].map((t, i) => (
                  <span key={t} style={{ fontFamily: b_font.mono, fontSize: 11,
                                          color: i === 0 ? B_T.text : B_T.mute2 }}>
                    {t}
                  </span>
                ))}
              </div>
              <span style={{ fontFamily: b_font.mono, fontSize: 11, color: B_T.mute2 }}>
                ⌘K  search
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${B_T.line}` }}>
                  {['ID', 'Borrower', 'Principal', 'Interest', 'Rate', 'Due', 'Status'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: i >= 2 && i <= 5 ? 'right' : i === 6 ? 'right' : 'left',
                                          fontFamily: b_font.mono, fontSize: 10, color: B_T.mute2,
                                          fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {S.loans.slice(0, 6).map(l => <BRow key={l.id} l={l} S={S} />)}
              </tbody>
            </table>
          </section>

          {/* Right rail */}
          <aside style={{ borderLeft: `1px solid ${B_T.line}`, padding: '24px',
                          background: '#0e0f13', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute,
                            letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                Today
              </div>
              <div style={{ padding: 14, border: `1px solid ${B_T.lime}`, borderRadius: 6,
                            background: 'rgba(201,255,58,.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Aom S.</span>
                  <BPill solid>COLLECT</BPill>
                </div>
                <div style={{ fontFamily: b_font.mono, fontSize: 22, fontWeight: 500,
                              fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
                  ฿5,250
                </div>
                <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute, marginTop: 4 }}>
                  ฿5,000 + ฿250 int · L240312
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button style={{ flex: 1, padding: '7px 0', background: B_T.lime, color: '#0a0c10',
                                    border: 'none', borderRadius: 4, fontFamily: b_font.sans,
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Mark paid</button>
                  <button style={{ flex: 1, padding: '7px 0', background: 'transparent',
                                    color: B_T.text, border: `1px solid ${B_T.line}`, borderRadius: 4,
                                    fontFamily: b_font.sans, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Renew</button>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute,
                            letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12,
                            display: 'flex', justifyContent: 'space-between' }}>
                <span>Overdue · 1</span>
                <span style={{ color: B_T.rose }}>−฿3,120</span>
              </div>
              <div style={{ padding: 12, borderRadius: 6, background: B_T.surface }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Bank P.</span>
                  <span style={{ fontFamily: b_font.mono, fontSize: 11, color: B_T.rose }}>3d</span>
                </div>
                <div style={{ fontFamily: b_font.mono, fontSize: 11, color: B_T.mute }}>
                  ฿3,000 + ฿120 · was due May 9
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute,
                            letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                Allocation
              </div>
              {[
                ['Deployed', s.deployed, B_T.lime, 75],
                ['Available', s.available, B_T.mute, 25],
                ['Defaulted', 3500, B_T.rose, 11],
              ].map(([label, val, color, pct]) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                fontFamily: b_font.mono, fontSize: 11, color: B_T.mute,
                                marginBottom: 4 }}>
                    <span>{label}</span>
                    <span style={{ color: B_T.text }}>{S.fmt(val)}</span>
                  </div>
                  <div style={{ height: 3, background: B_T.surface, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── B · Mobile ──────────────────────────────────────────────────
function BBankMobile() {
  const S = window.SEED, s = S.summary;
  return (
    <div style={{ width: 390, height: 760, background: B_T.bg, color: B_T.text,
                  fontFamily: b_font.sans, boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column' }}>
      {/* status bar */}
      <div style={{ height: 38, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0 24px', fontFamily: b_font.mono, fontSize: 12, color: B_T.text }}>
        <span>9:41</span>
        <div style={{ width: 110, height: 28, borderRadius: 14, background: '#000' }} />
        <span style={{ fontSize: 11 }}>●●● ◐</span>
      </div>

      <div style={{ padding: '12px 22px 8px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute2,
                        letterSpacing: '.08em', textTransform: 'uppercase' }}>
            principal.
          </div>
          <div style={{ fontSize: 17, fontWeight: 500, marginTop: 2 }}>Hello again.</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 4, background: B_T.surface,
                       display: 'grid', placeItems: 'center', fontFamily: b_font.mono,
                       fontSize: 11 }}>K</div>
      </div>

      <div style={{ padding: '14px 22px 18px' }}>
        <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute,
                       letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Total portfolio
        </div>
        <div style={{ fontFamily: b_font.mono, fontSize: 38, fontWeight: 500,
                       color: B_T.text, fontVariantNumeric: 'tabular-nums',
                       letterSpacing: '-.025em', marginTop: 4 }}>
          {S.fmt(s.totalLimit)}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
          <BPill tone="green">↗ {S.fmtSign(s.netProfit)}</BPill>
          <span style={{ fontFamily: b_font.mono, fontSize: 11, color: B_T.mute }}>
            +{s.profitPct.toFixed(1)}% life
          </span>
        </div>
      </div>

      <div style={{ margin: '0 22px', height: 90, position: 'relative' }}>
        <BAreaChart data={S.monthly} w={346} h={90} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${B_T.line}`,
                    borderBottom: `1px solid ${B_T.line}`, marginTop: 18 }}>
        <div style={{ padding: '12px 22px', borderRight: `1px solid ${B_T.line}` }}>
          <div style={{ fontFamily: b_font.mono, fontSize: 9, color: B_T.mute2,
                         letterSpacing: '.08em', textTransform: 'uppercase' }}>Available</div>
          <div style={{ fontFamily: b_font.mono, fontSize: 18, fontWeight: 500,
                         marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {S.fmt(s.available)}
          </div>
        </div>
        <div style={{ padding: '12px 22px' }}>
          <div style={{ fontFamily: b_font.mono, fontSize: 9, color: B_T.mute2,
                         letterSpacing: '.08em', textTransform: 'uppercase' }}>NPL</div>
          <div style={{ fontFamily: b_font.mono, fontSize: 18, fontWeight: 500,
                         marginTop: 2, color: B_T.rose, fontVariantNumeric: 'tabular-nums' }}>
            {s.nplRatio.toFixed(1)}%
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 22px 6px', display: 'flex', justifyContent: 'space-between',
                     alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Today & overdue</span>
        <span style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute }}>2 items</span>
      </div>

      <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {[
          { l: S.loans[0], tone: 'lime',  pill: 'COLLECT' },
          { l: S.loans[1], tone: 'rose',  pill: 'OVERDUE 3d' },
        ].map(({ l, tone, pill }) => (
          <div key={l.id} style={{ padding: '12px 14px', borderRadius: 6, background: B_T.surface,
                                    display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 4, background: B_T.surface2,
                           display: 'grid', placeItems: 'center', fontFamily: b_font.mono,
                           fontSize: 11, color: B_T.text }}>{l.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{l.name}</div>
              <div style={{ fontFamily: b_font.mono, fontSize: 10, color: B_T.mute, marginTop: 2 }}>
                {l.id} · due {l.due}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: b_font.mono, fontSize: 14, fontWeight: 500,
                             fontVariantNumeric: 'tabular-nums' }}>
                {S.fmt(l.total)}
              </div>
              <div style={{ marginTop: 4 }}><BPill tone={tone} solid={tone === 'lime'}>{pill}</BPill></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <nav style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 0 24px',
                     borderTop: `1px solid ${B_T.line}`, marginTop: 14 }}>
        {[['Home', true], ['Loans', false], ['Add', false, true], ['Reports', false], ['You', false]]
          .map(([l, active, primary]) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: primary ? 36 : 22, height: primary ? 36 : 22, borderRadius: primary ? 8 : 4,
                           background: primary ? B_T.lime : active ? B_T.surface : 'transparent',
                           border: !primary && !active ? `1px solid ${B_T.line}` : 'none',
                           display: 'grid', placeItems: 'center',
                           color: primary ? '#0a0c10' : active ? B_T.text : B_T.mute2,
                           fontSize: primary ? 18 : 12, fontFamily: b_font.mono, fontWeight: 600 }}>
              {primary ? '+' : '◇'}
            </div>
            <span style={{ fontFamily: b_font.mono, fontSize: 9,
                            color: active ? B_T.text : B_T.mute2,
                            letterSpacing: '.04em' }}>{l}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

window.BBankDesktop = BBankDesktop;
window.BBankMobile  = BBankMobile;
