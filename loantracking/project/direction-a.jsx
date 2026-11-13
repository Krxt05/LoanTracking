/* global React */
// Direction A — "Ledger"
// Editorial serif + monospace numerals on cream paper. Hairline rules,
// no rounded corners on data, oxblood single accent. Slow-money aesthetic.

const A_T = {
  cream:  '#f3ece0',
  paper:  '#faf6ec',
  ink:    '#1a1410',
  ink2:   '#3d342a',
  mute:   '#85786a',
  rule:   '#d6cab3',
  rule2:  '#ebe1cb',
  ox:     '#7d2c1a',
  oxSoft: '#c46b53',
  green:  '#3d6647',
  amber:  '#a66b1f',
};

const a_font = {
  display: '"Crimson Pro", "EB Garamond", Georgia, serif',
  body:    '"Inter Tight", "Inter", system-ui, sans-serif',
  mono:    '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
};

const aRow = (label, value, opts = {}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '8px 0', borderBottom: `1px solid ${A_T.rule2}`,
                fontSize: 12, color: A_T.ink2 }}>
    <span style={{ letterSpacing: '.04em', textTransform: 'uppercase', fontSize: 10, color: A_T.mute }}>{label}</span>
    <span style={{ fontFamily: a_font.mono, fontVariantNumeric: 'tabular-nums',
                   color: opts.color || A_T.ink, fontWeight: 500 }}>{value}</span>
  </div>
);

function ALedgerHead({ title, sub, page }) {
  return (
    <div style={{ borderBottom: `1px solid ${A_T.ink}`, paddingBottom: 14, marginBottom: 22,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div>
        <div style={{ fontFamily: a_font.mono, fontSize: 10, letterSpacing: '.18em',
                      color: A_T.mute, textTransform: 'uppercase', marginBottom: 6 }}>
          The Lender's Journal · No. 14
        </div>
        <h1 style={{ fontFamily: a_font.display, fontWeight: 500, fontSize: 38,
                     lineHeight: 1, letterSpacing: '-.01em', color: A_T.ink, margin: 0,
                     fontStyle: 'italic' }}>
          {title}
        </h1>
        {sub && <div style={{ fontFamily: a_font.body, fontSize: 12, color: A_T.mute, marginTop: 6 }}>{sub}</div>}
      </div>
      <div style={{ textAlign: 'right', fontFamily: a_font.mono, fontSize: 10,
                    color: A_T.mute, letterSpacing: '.05em' }}>
        <div>MAY · MMXXVI</div>
        <div style={{ marginTop: 4 }}>Folio {page}</div>
      </div>
    </div>
  );
}

function ABigFigure({ label, value, sub, accent }) {
  return (
    <div style={{ borderTop: `1px solid ${A_T.rule}`, paddingTop: 12 }}>
      <div style={{ fontFamily: a_font.mono, fontSize: 9, letterSpacing: '.18em',
                    textTransform: 'uppercase', color: A_T.mute, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: a_font.display, fontSize: 42, fontWeight: 500, lineHeight: 1,
                    color: A_T.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: a_font.body, fontSize: 11, color: accent || A_T.mute,
                            marginTop: 8, fontStyle: 'italic' }}>{sub}</div>}
    </div>
  );
}

function ALoanRow({ l, S }) {
  const statusColor = {
    'overdue': A_T.ox,
    'due-today': A_T.amber,
    'active': A_T.ink2,
    'renewed': A_T.green,
    'paid': A_T.mute,
    'default': A_T.ox,
  }[l.status];
  const statusGloss = {
    'overdue': 'overdue',
    'due-today': 'due today',
    'active': 'open',
    'renewed': `renewed ×${l.renewCount || 1}`,
    'paid': 'settled',
    'default': 'in default',
  }[l.status];
  return (
    <tr style={{ borderBottom: `1px solid ${A_T.rule2}` }}>
      <td style={{ padding: '12px 8px', fontFamily: a_font.mono, fontSize: 10, color: A_T.mute,
                   fontVariantNumeric: 'tabular-nums' }}>{l.id}</td>
      <td style={{ padding: '12px 8px', fontFamily: a_font.display, fontSize: 16,
                   color: A_T.ink, fontStyle: 'italic' }}>{l.name}</td>
      <td style={{ padding: '12px 8px', fontFamily: a_font.mono, fontSize: 12,
                   color: A_T.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {S.fmtPlain(l.principal)}.—
      </td>
      <td style={{ padding: '12px 8px', fontFamily: a_font.mono, fontSize: 12,
                   color: A_T.ink2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {l.rate}%
      </td>
      <td style={{ padding: '12px 8px', fontFamily: a_font.mono, fontSize: 12,
                   color: A_T.ink2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {l.due}
      </td>
      <td style={{ padding: '12px 8px', fontFamily: a_font.body, fontSize: 11,
                   color: statusColor, textAlign: 'right', fontStyle: 'italic',
                   letterSpacing: '.02em' }}>
        {statusGloss}
      </td>
    </tr>
  );
}

function ASparkline({ data, w = 220, h = 64 }) {
  const max = Math.max(...data.map(d => d.interest));
  const step = w / (data.length - 1);
  const pts = data.map((d, i) => [i * step, h - (d.interest / max) * (h - 10) - 4]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={A_T.ink} strokeWidth="1.25" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill={A_T.paper} stroke={A_T.ink} strokeWidth="1" />
      ))}
    </svg>
  );
}

// ─── A · Desktop dashboard ─────────────────────────────────────────
function ALedgerDesktop() {
  const S = window.SEED, s = S.summary;
  return (
    <div style={{ width: 1280, height: 820, background: A_T.cream, color: A_T.ink,
                  fontFamily: a_font.body, padding: '40px 56px', boxSizing: 'border-box',
                  position: 'relative', overflow: 'hidden' }}>
      {/* Paper grain */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none',
                    background: `repeating-linear-gradient(0deg, transparent 0, transparent 28px, ${A_T.rule2} 28px, ${A_T.rule2} 29px)` }} />
      <div style={{ position: 'relative' }}>
        <ALedgerHead title={<>An Account of <span style={{ fontStyle: 'normal' }}>Small Loans</span></>}
                     sub="Kept by hand, settled in person, recorded for posterity." page="XIV" />

        {/* Top — 4 figures */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, marginBottom: 32 }}>
          <ABigFigure label="Portfolio at hand" value={S.fmt(s.totalLimit)}
                      sub={`from ${S.fmt(s.initialCapital)} principal capital`} />
          <ABigFigure label="Profit, net of losses" value={S.fmtSign(s.netProfit)}
                      sub={`${s.profitPct.toFixed(1)}% return, life-to-date`} accent={A_T.green} />
          <ABigFigure label="Doubtful debts" value={s.nplRatio.toFixed(1) + '%'}
                      sub="one borrower in default" accent={A_T.ox} />
          <ABigFigure label="Cash, idle" value={S.fmt(s.available)}
                      sub="awaiting a worthy borrower" />
        </div>

        {/* Mid — ledger + collections panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                          borderBottom: `2px solid ${A_T.ink}`, paddingBottom: 8, marginBottom: 4 }}>
              <h2 style={{ fontFamily: a_font.display, fontStyle: 'italic', fontWeight: 500,
                           fontSize: 22, margin: 0, color: A_T.ink }}>Open accounts</h2>
              <div style={{ display: 'flex', gap: 16, fontFamily: a_font.mono, fontSize: 10,
                            color: A_T.mute, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                <span style={{ borderBottom: `1px solid ${A_T.ink}`, paddingBottom: 2, color: A_T.ink }}>active</span>
                <span>renewed</span>
                <span>settled</span>
                <span>default</span>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '14%' }} /><col style={{ width: '26%' }} />
                <col style={{ width: '18%' }} /><col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} /><col style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: `1px solid ${A_T.rule}` }}>
                  {['Folio', 'Borrower', 'Principal', 'Rate', 'Due', 'Standing'].map((h, i) => (
                    <th key={h} style={{ padding: '8px', textAlign: i >= 2 ? 'right' : 'left',
                                          fontFamily: a_font.mono, fontSize: 9, letterSpacing: '.16em',
                                          textTransform: 'uppercase', color: A_T.mute, fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {S.loans.slice(0, 6).map(l => <ALoanRow key={l.id} l={l} S={S} />)}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          marginTop: 16, fontFamily: a_font.mono, fontSize: 10, color: A_T.mute }}>
              <span style={{ fontStyle: 'italic', fontFamily: a_font.display, fontSize: 13 }}>
                — eight accounts of record —
              </span>
              <span>carried forward to folio XV  ›</span>
            </div>
          </div>

          {/* Right column — collections + chart */}
          <div>
            <div style={{ border: `1px solid ${A_T.ink}`, padding: 18, background: A_T.paper, marginBottom: 18 }}>
              <div style={{ fontFamily: a_font.mono, fontSize: 9, letterSpacing: '.16em',
                            textTransform: 'uppercase', color: A_T.mute, marginBottom: 10 }}>
                To collect this day
              </div>
              <div style={{ fontFamily: a_font.display, fontStyle: 'italic', fontSize: 28,
                            color: A_T.ox, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {S.fmt(5250)}
              </div>
              <div style={{ fontFamily: a_font.body, fontSize: 11, color: A_T.ink2, marginTop: 8,
                            fontStyle: 'italic' }}>
                Aom S. — falls due today, ฿250 expected.
              </div>
              <div style={{ borderTop: `1px solid ${A_T.rule}`, marginTop: 14, paddingTop: 12 }}>
                <div style={{ fontFamily: a_font.mono, fontSize: 9, letterSpacing: '.16em',
                              textTransform: 'uppercase', color: A_T.mute, marginBottom: 8 }}>
                  Past due
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: a_font.display, fontStyle: 'italic', fontSize: 17 }}>
                    Bank P.
                  </span>
                  <span style={{ fontFamily: a_font.mono, fontSize: 12, color: A_T.ox,
                                 fontVariantNumeric: 'tabular-nums' }}>
                    ฿3,120 · 3d
                  </span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${A_T.ink}`, paddingTop: 12 }}>
              <div style={{ fontFamily: a_font.mono, fontSize: 9, letterSpacing: '.16em',
                            textTransform: 'uppercase', color: A_T.mute, marginBottom: 12 }}>
                Six months of interest
              </div>
              <ASparkline data={S.monthly} w={220} h={56} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8,
                            fontFamily: a_font.mono, fontSize: 9, color: A_T.mute }}>
                {S.monthly.map(m => <span key={m.m}>{m.m}</span>)}
              </div>
              <div style={{ marginTop: 14, fontFamily: a_font.body, fontSize: 11, fontStyle: 'italic',
                            color: A_T.ink2, lineHeight: 1.6 }}>
                "May yields {S.fmt(s.monthInterest)} so far — fourteen percent above April's hand."
              </div>
            </div>

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${A_T.rule}`,
                          fontFamily: a_font.mono, fontSize: 9, letterSpacing: '.14em',
                          color: A_T.mute, textTransform: 'uppercase', display: 'flex',
                          justifyContent: 'space-between' }}>
              <span>signed,</span><span>the lender</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── A · Mobile ────────────────────────────────────────────────────
function ALedgerMobile() {
  const S = window.SEED, s = S.summary;
  return (
    <div style={{ width: 390, height: 760, background: A_T.cream, color: A_T.ink,
                  fontFamily: a_font.body, padding: '28px 22px', boxSizing: 'border-box',
                  position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none',
                    background: `repeating-linear-gradient(0deg, transparent 0, transparent 26px, ${A_T.rule2} 26px, ${A_T.rule2} 27px)` }} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: a_font.mono, fontSize: 9, letterSpacing: '.2em', color: A_T.mute,
                      textTransform: 'uppercase', marginBottom: 4 }}>
          The Journal · MMXXVI
        </div>
        <h1 style={{ fontFamily: a_font.display, fontStyle: 'italic', fontWeight: 500,
                     fontSize: 30, margin: 0, lineHeight: 1, color: A_T.ink, letterSpacing: '-.01em' }}>
          Tuesday, May 12th
        </h1>
        <div style={{ borderBottom: `1px solid ${A_T.ink}`, marginTop: 14, marginBottom: 18 }} />

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: a_font.mono, fontSize: 9, letterSpacing: '.18em',
                        color: A_T.mute, textTransform: 'uppercase' }}>Portfolio</div>
          <div style={{ fontFamily: a_font.display, fontWeight: 500, fontSize: 40, lineHeight: 1,
                        color: A_T.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em',
                        marginTop: 4 }}>
            {S.fmt(s.totalLimit)}
          </div>
          <div style={{ fontFamily: a_font.body, fontSize: 11, color: A_T.green, marginTop: 6,
                        fontStyle: 'italic' }}>
            {S.fmtSign(s.netProfit)} earned, {s.profitPct.toFixed(1)}% return
          </div>
        </div>

        {aRow('Idle cash', S.fmt(s.available))}
        {aRow('Out on loan', S.fmt(s.deployed))}
        {aRow('Doubtful', s.nplRatio.toFixed(1) + '%', { color: A_T.ox })}
        {aRow('May interest', S.fmt(s.monthInterest), { color: A_T.green })}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        borderBottom: `1px solid ${A_T.ink}`, paddingBottom: 6, marginBottom: 12 }}>
            <h2 style={{ fontFamily: a_font.display, fontStyle: 'italic', fontWeight: 500,
                         fontSize: 18, margin: 0 }}>Today's collections</h2>
            <span style={{ fontFamily: a_font.mono, fontSize: 9, color: A_T.mute,
                           letterSpacing: '.1em', textTransform: 'uppercase' }}>2 due</span>
          </div>

          {[
            { l: S.loans[0], pill: 'today', color: A_T.amber },
            { l: S.loans[1], pill: '3d late', color: A_T.ox },
          ].map(({ l, pill, color }) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center',
                                      padding: '14px 0', borderBottom: `1px solid ${A_T.rule2}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: a_font.display, fontSize: 18, fontStyle: 'italic', color: A_T.ink }}>
                  {l.name}
                </div>
                <div style={{ fontFamily: a_font.mono, fontSize: 10, color: A_T.mute, marginTop: 2 }}>
                  {l.id} · {l.borrowed} → {l.due}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: a_font.mono, fontSize: 14, color: A_T.ink,
                               fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {S.fmt(l.total)}
                </div>
                <div style={{ fontFamily: a_font.body, fontSize: 10, color, fontStyle: 'italic',
                               marginTop: 2 }}>
                  {pill}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button style={{ marginTop: 22, width: '100%', padding: '14px 0', background: A_T.ink,
                         color: A_T.cream, border: 'none', fontFamily: a_font.display,
                         fontSize: 14, fontStyle: 'italic', fontWeight: 500, letterSpacing: '.02em',
                         cursor: 'pointer' }}>
          Enter a new account  &nbsp;›
        </button>
      </div>
    </div>
  );
}

window.ALedgerDesktop = ALedgerDesktop;
window.ALedgerMobile = ALedgerMobile;
