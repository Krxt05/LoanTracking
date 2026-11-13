/* global React */
// Direction C — "Pocket"
// Friendly mobile-first personal-finance vibe. Hanken Grotesk + warm cream,
// soft pastel palette, generous rounded cards, conversational copy.

const C_T = {
  cream:    '#fbf6ec',
  cream2:   '#f4ecdc',
  ink:      '#1b1f2a',
  ink2:     '#3a4254',
  mute:     '#7a8298',
  mint:     '#a8d8b9',
  mintDeep: '#2f7a5a',
  butter:   '#fae28d',
  butterDeep:'#9a7a14',
  blush:    '#f6c3b1',
  blushDeep:'#a04a2c',
  lavender: '#cdc6f0',
  card:     '#ffffff',
  line:     '#eee4cf',
};

const c_font = {
  display: '"Hanken Grotesk", "Plus Jakarta Sans", "Inter Tight", system-ui, sans-serif',
  body:    '"Hanken Grotesk", system-ui, sans-serif',
  mono:    '"DM Mono", "JetBrains Mono", ui-monospace, monospace',
};

function CChip({ children, tone = 'mint' }) {
  const toneMap = {
    mint:   { bg: C_T.mint,   fg: C_T.mintDeep },
    butter: { bg: C_T.butter, fg: C_T.butterDeep },
    blush:  { bg: C_T.blush,  fg: C_T.blushDeep },
    lav:    { bg: C_T.lavender, fg: '#3d3680' },
    ghost:  { bg: '#0000000a', fg: C_T.ink2 },
  };
  const t = toneMap[tone];
  return (
    <span style={{ padding: '4px 10px', borderRadius: 999, background: t.bg, color: t.fg,
                   fontSize: 11, fontWeight: 600, letterSpacing: '.01em', display: 'inline-flex',
                   alignItems: 'center', gap: 4 }}>
      {children}
    </span>
  );
}

function CCard({ children, color = C_T.card, pad = 18, style }) {
  return (
    <div style={{ background: color, borderRadius: 22, padding: pad,
                   boxShadow: '0 1px 0 rgba(27,31,42,.04), 0 8px 24px -16px rgba(27,31,42,.18)',
                   ...style }}>
      {children}
    </div>
  );
}

// pastel donut for allocation
function CDonut({ size = 110, segs }) {
  const C = 2 * Math.PI * 42;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 110 110">
      <circle cx="55" cy="55" r="42" fill="none" stroke={C_T.cream2} strokeWidth="14" />
      {segs.map((s, i) => {
        const dash = (s.pct / 100) * C;
        const el = (
          <circle key={i} cx="55" cy="55" r="42" fill="none" stroke={s.color}
                  strokeWidth="14" strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-offset} transform="rotate(-90 55 55)" strokeLinecap="butt" />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

const cStatusColor = {
  'overdue': 'blush', 'due-today': 'butter', 'active': 'ghost',
  'renewed': 'lav', 'paid': 'mint', 'default': 'blush',
};
const cStatusText = {
  'overdue': 'Overdue', 'due-today': 'Today', 'active': 'On track',
  'renewed': 'Renewed', 'paid': 'Paid', 'default': 'Bad debt',
};

// ─── C · Desktop ─────────────────────────────────────────────────
function CPocketDesktop() {
  const S = window.SEED, s = S.summary;
  return (
    <div style={{ width: 1280, height: 820, background: C_T.cream, color: C_T.ink,
                   fontFamily: c_font.body, padding: 36, boxSizing: 'border-box',
                   display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: C_T.ink,
                         display: 'grid', placeItems: 'center', color: C_T.butter,
                         fontFamily: c_font.display, fontSize: 18, fontWeight: 800 }}>P</div>
          <div>
            <div style={{ fontFamily: c_font.display, fontSize: 18, fontWeight: 700,
                            letterSpacing: '-.02em' }}>Pocket</div>
            <div style={{ fontSize: 11, color: C_T.mute }}>Your tiny lending desk</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ padding: '8px 14px', borderRadius: 999, background: '#fff',
                         fontSize: 12, color: C_T.ink2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: C_T.mintDeep }} />
            Synced 2m ago
          </div>
          <button style={{ padding: '10px 18px', borderRadius: 999, background: C_T.ink,
                            color: C_T.cream, border: 'none', fontFamily: c_font.display,
                            fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Lend money
          </button>
        </div>
      </header>

      {/* Hero greeting */}
      <CCard color={C_T.ink} pad={28} style={{ color: C_T.cream, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 280, height: 280,
                       borderRadius: '50%', background: 'radial-gradient(circle, rgba(250,226,141,.18), transparent 70%)' }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between',
                       alignItems: 'center', gap: 40 }}>
          <div style={{ flex: 1, minWidth: 0, maxWidth: 600 }}>
            <div style={{ fontSize: 12, color: C_T.butter, fontWeight: 600,
                           letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Tuesday afternoon
            </div>
            <h1 style={{ fontFamily: c_font.display, fontSize: 30, fontWeight: 700, lineHeight: 1.2,
                          letterSpacing: '-.025em', margin: '8px 0 8px' }}>
              You're up <span style={{ color: C_T.butter }}>{S.fmtSign(s.netProfit)}</span> since you started.
            </h1>
            <div style={{ fontSize: 14, color: 'rgba(251,246,236,.72)', lineHeight: 1.5 }}>
              Aom owes you ฿5,250 today. 7 loans out, 1 overdue, 1 idle — May is a touch lighter than April.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(251,246,236,.6)',
                           letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              Portfolio
            </div>
            <div style={{ fontFamily: c_font.display, fontSize: 56, fontWeight: 700,
                           letterSpacing: '-.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {S.fmt(s.totalLimit)}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: C_T.mint }}>
              ↗ +{s.profitPct.toFixed(1)}% since seed of ฿20,000
            </div>
          </div>
        </div>
      </CCard>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, flex: 1 }}>
        {/* Available + donut */}
        <CCard color={C_T.cream2} pad={22}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C_T.mute, marginBottom: 14,
                          letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Where your money is
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <CDonut segs={[
              { pct: 75, color: C_T.mintDeep },
              { pct: 11, color: C_T.blushDeep },
              { pct: 14, color: C_T.butterDeep },
            ]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {[
                ['Out earning', S.fmt(s.deployed), C_T.mintDeep],
                ['Stuck (default)', S.fmt(3500), C_T.blushDeep],
                ['Free to lend', S.fmt(s.available), C_T.butterDeep],
              ].map(([l, v, c]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C_T.ink2 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: c }} />
                    {l}
                  </span>
                  <span style={{ fontWeight: 700, color: C_T.ink }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </CCard>

        {/* Today */}
        <CCard color={C_T.butter} pad={22}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C_T.butterDeep, marginBottom: 4,
                          letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Collect today
          </div>
          <div style={{ fontFamily: c_font.display, fontSize: 38, fontWeight: 700,
                          letterSpacing: '-.025em', color: C_T.ink, marginBottom: 16 }}>
            ฿5,250
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                          background: 'rgba(255,255,255,.55)', borderRadius: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: C_T.ink,
                            color: C_T.butter, display: 'grid', placeItems: 'center',
                            fontWeight: 700, fontSize: 14 }}>AS</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Aom Saetang</div>
              <div style={{ fontSize: 11, color: C_T.ink2, marginTop: 2 }}>
                ฿5,000 + ฿250 interest · 7 days
              </div>
            </div>
            <button style={{ padding: '8px 14px', borderRadius: 999, background: C_T.ink,
                              color: C_T.cream, border: 'none', fontSize: 12, fontWeight: 700,
                              cursor: 'pointer' }}>Got paid</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: C_T.butterDeep, fontStyle: 'italic' }}>
            Tap when the cash actually lands in your hand.
          </div>
        </CCard>

        {/* This month */}
        <CCard pad={22}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C_T.mute, marginBottom: 4,
                          letterSpacing: '.04em', textTransform: 'uppercase' }}>
            This month so far
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span style={{ fontFamily: c_font.display, fontSize: 38, fontWeight: 700,
                            color: C_T.ink, letterSpacing: '-.025em' }}>
              {S.fmt(s.monthInterest)}
            </span>
            <span style={{ color: C_T.mintDeep, fontSize: 13, fontWeight: 600 }}>↗ 14.8%</span>
          </div>
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 84, paddingTop: 6 }}>
            {S.monthly.map((m, i) => {
              const max = Math.max(...S.monthly.map(x => x.interest));
              const h = (m.interest / max) * 78;
              const isCurrent = i === S.monthly.length - 1;
              return (
                <div key={m.m} style={{ flex: 1, display: 'flex', flexDirection: 'column',
                                          alignItems: 'center', gap: 6 }}>
                  <div style={{ width: '100%', height: h, borderRadius: 6,
                                  background: isCurrent ? C_T.ink : C_T.mint,
                                  position: 'relative' }}>
                    {isCurrent && (
                      <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
                                      background: C_T.ink, color: C_T.cream, fontSize: 10,
                                      padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                        +฿1.2k
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: C_T.mute }}>{m.m}</span>
                </div>
              );
            })}
          </div>
        </CCard>
      </div>

      {/* Active loans list */}
      <CCard pad={22} style={{ flex: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 14 }}>
          <h2 style={{ fontFamily: c_font.display, fontSize: 18, fontWeight: 700,
                         letterSpacing: '-.02em', margin: 0 }}>Loans out right now</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {['All 7', 'Today 1', 'Late 1', 'Renewed 1'].map((t, i) => (
              <span key={t} style={{ padding: '6px 12px', borderRadius: 999,
                                       background: i === 0 ? C_T.ink : 'transparent',
                                       color: i === 0 ? C_T.cream : C_T.ink2,
                                       fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {S.loans.slice(0, 4).map((l, i) => {
            const toneBg = [C_T.cream2, C_T.butter, C_T.blush, C_T.lavender][i];
            return (
              <div key={l.id} style={{ background: toneBg, borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: C_T.ink,
                                  color: C_T.cream, display: 'grid', placeItems: 'center',
                                  fontWeight: 700, fontSize: 13 }}>{l.avatar}</div>
                  <CChip tone={cStatusColor[l.status]}>{cStatusText[l.status]}</CChip>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{l.name}</div>
                <div style={{ fontSize: 11, color: C_T.ink2, marginTop: 2 }}>
                  {l.borrowed} → {l.due}
                </div>
                <div style={{ marginTop: 12, fontFamily: c_font.display, fontSize: 22, fontWeight: 700,
                                letterSpacing: '-.02em' }}>
                  {S.fmt(l.total)}
                </div>
                <div style={{ fontSize: 11, color: C_T.ink2, marginTop: 2 }}>
                  +{S.fmt(l.interest)} interest
                </div>
              </div>
            );
          })}
        </div>
      </CCard>
    </div>
  );
}

// ─── C · Mobile ──────────────────────────────────────────────────
function CPocketMobile() {
  const S = window.SEED, s = S.summary;
  return (
    <div style={{ width: 390, height: 760, background: C_T.cream, color: C_T.ink,
                   fontFamily: c_font.body, boxSizing: 'border-box', overflow: 'hidden',
                   display: 'flex', flexDirection: 'column' }}>
      {/* status bar */}
      <div style={{ height: 38, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                     padding: '0 24px', fontSize: 13, fontWeight: 700 }}>
        <span>9:41</span>
        <div style={{ width: 110, height: 28, borderRadius: 14, background: '#000' }} />
        <span style={{ fontSize: 11 }}>●●● ◐</span>
      </div>

      {/* Greeting */}
      <div style={{ padding: '8px 22px 4px', display: 'flex', justifyContent: 'space-between',
                     alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: C_T.mute, fontWeight: 600,
                          letterSpacing: '.06em', textTransform: 'uppercase' }}>Hey Kit</div>
          <div style={{ fontFamily: c_font.display, fontSize: 22, fontWeight: 700,
                          letterSpacing: '-.02em', marginTop: 2 }}>
            One person owes you today.
          </div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: C_T.ink,
                       color: C_T.butter, display: 'grid', placeItems: 'center',
                       fontWeight: 700 }}>K</div>
      </div>

      {/* Hero card */}
      <div style={{ padding: '14px 18px' }}>
        <CCard color={C_T.ink} pad={20} style={{ color: C_T.cream, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 160, height: 160,
                          borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,216,185,.25), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, color: C_T.mint, fontWeight: 600,
                            letterSpacing: '.06em', textTransform: 'uppercase' }}>Your portfolio</div>
            <div style={{ fontFamily: c_font.display, fontSize: 42, fontWeight: 700,
                            letterSpacing: '-.025em', marginTop: 4, lineHeight: 1,
                            fontVariantNumeric: 'tabular-nums' }}>
              {S.fmt(s.totalLimit)}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <CChip tone="mint">↗ {S.fmtSign(s.netProfit)}</CChip>
              <span style={{ fontSize: 12, color: 'rgba(251,246,236,.65)' }}>
                +{s.profitPct.toFixed(1)}% lifetime
              </span>
            </div>

            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.08)' }}>
                <div style={{ fontSize: 10, color: 'rgba(251,246,236,.6)', textTransform: 'uppercase',
                                letterSpacing: '.06em' }}>Free</div>
                <div style={{ fontFamily: c_font.display, fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                  {S.fmt(s.available)}
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.08)' }}>
                <div style={{ fontSize: 10, color: 'rgba(251,246,236,.6)', textTransform: 'uppercase',
                                letterSpacing: '.06em' }}>Working</div>
                <div style={{ fontFamily: c_font.display, fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                  {S.fmt(s.deployed)}
                </div>
              </div>
            </div>
          </div>
        </CCard>
      </div>

      {/* Today */}
      <div style={{ padding: '6px 18px 10px' }}>
        <CCard color={C_T.butter} pad={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                          marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: C_T.butterDeep, fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '.06em' }}>Today</div>
              <div style={{ fontFamily: c_font.display, fontSize: 28, fontWeight: 700,
                              letterSpacing: '-.02em', marginTop: 2 }}>
                ฿5,250 coming in
              </div>
            </div>
            <CChip tone="ghost">1 due</CChip>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                          background: '#fff', borderRadius: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: C_T.ink,
                            color: C_T.butter, display: 'grid', placeItems: 'center',
                            fontWeight: 700, fontSize: 13 }}>AS</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Aom S.</div>
              <div style={{ fontSize: 11, color: C_T.ink2 }}>
                ฿5,000 + ฿250 · borrowed May 5
              </div>
            </div>
            <button style={{ padding: '8px 12px', borderRadius: 999, background: C_T.ink,
                              color: C_T.cream, border: 'none', fontSize: 11, fontWeight: 700 }}>
              Mark paid
            </button>
          </div>
        </CCard>
      </div>

      {/* Loans scroll */}
      <div style={{ flex: 1, padding: '6px 18px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                       marginBottom: 8, padding: '0 4px' }}>
          <span style={{ fontFamily: c_font.display, fontSize: 15, fontWeight: 700 }}>
            All loans out
          </span>
          <span style={{ fontSize: 12, color: C_T.mute }}>see all 7 ›</span>
        </div>
        {S.loans.slice(1, 4).map(l => (
          <div key={l.id} style={{ background: '#fff', borderRadius: 16, padding: 12,
                                     marginBottom: 8, display: 'flex', alignItems: 'center',
                                     gap: 12, boxShadow: '0 1px 0 rgba(27,31,42,.04)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12,
                            background: l.status === 'overdue' ? C_T.blush
                                     : l.status === 'renewed' ? C_T.lavender : C_T.mint,
                            color: C_T.ink, display: 'grid', placeItems: 'center',
                            fontWeight: 700, fontSize: 12 }}>{l.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{l.name}</div>
              <div style={{ fontSize: 11, color: C_T.mute, marginTop: 2 }}>
                {cStatusText[l.status]} · {l.dueRel}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: c_font.display, fontSize: 14, fontWeight: 700,
                              letterSpacing: '-.01em' }}>{S.fmt(l.total)}</div>
              <div style={{ fontSize: 10, color: C_T.mintDeep, marginTop: 2 }}>
                +฿{l.interest}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Big lend button */}
      <div style={{ padding: '4px 18px 16px' }}>
        <button style={{ width: '100%', padding: '14px 0', borderRadius: 999, background: C_T.ink,
                          color: C_T.cream, border: 'none', fontFamily: c_font.display,
                          fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          + Lend to someone
        </button>
      </div>
    </div>
  );
}

window.CPocketDesktop = CPocketDesktop;
window.CPocketMobile  = CPocketMobile;
