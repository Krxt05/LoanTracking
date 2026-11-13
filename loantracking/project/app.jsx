/* global React, DesignCanvas, DCSection, DCArtboard, TweaksPanel, TweakSection, TweakRadio, useTweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "focus": "d",
  "showMobile": true,
  "showDesktop": true,
  "lang": "en"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const show = (k) => t.focus === 'all' || t.focus === k;
  window.LANG = t.lang;

  return (
    <>
      <DesignCanvas>
        {show('a') && (
          <DCSection id="a" title="A · Ledger"
            subtitle="Editorial serif on cream paper. Single oxblood accent, monospaced numerals, hairline rules. A bookkeeping-journal feel for the slow work of personal lending.">
            {t.showDesktop && <DCArtboard id="a-d" label="Desktop · Folio XIV" width={1280} height={820}>
              <window.ALedgerDesktop />
            </DCArtboard>}
            {t.showMobile && <DCArtboard id="a-m" label="Mobile · Today's journal" width={390} height={760}>
              <window.ALedgerMobile />
            </DCArtboard>}
          </DCSection>
        )}

        {show('b') && (
          <DCSection id="b" title="B · Quiet Bank"
            subtitle="Dark fintech. Tight grid, micro-typography, single cyber-lime accent on graphite. Dense data with intent — every number earns its place.">
            {t.showDesktop && <DCArtboard id="b-d" label="Desktop · Overview" width={1280} height={820}>
              <window.BBankDesktop />
            </DCArtboard>}
            {t.showMobile && <DCArtboard id="b-m" label="Mobile · Home" width={390} height={760}>
              <window.BBankMobile />
            </DCArtboard>}
          </DCSection>
        )}

        {show('d') && (
          <DCSection id="d" title="D · Pocket Bank"
            subtitle="B's structure, C's soul. The Quiet Bank dashboard layout — sidebar, KPI strip, area chart, dense table, right rail — in Pocket's warm cream + pastel language.">
            {t.showDesktop && <DCArtboard id="d-d" label="Desktop · Overview" width={1280} height={820}>
              <window.DPocketBankDesktop />
            </DCArtboard>}
            {t.showDesktop && <DCArtboard id="d-new" label="New loan · modal" width={1280} height={820}>
              <window.DNewLoanModal />
            </DCArtboard>}
            {t.showDesktop && <DCArtboard id="d-detail" label="Loan detail · drawer" width={480} height={820}>
              <window.DLoanDetail />
            </DCArtboard>}
            {t.showMobile && <DCArtboard id="d-m" label="Mobile · Home" width={390} height={760}>
              <window.DPocketBankMobile />
            </DCArtboard>}
          </DCSection>
        )}

        {show('c') && (
          <DCSection id="c" title="C · Pocket"
            subtitle="Warm, conversational personal-finance vibe. Soft pastel cards, rounded corners, friendly headlines. Cash App energy for someone running a tiny lending desk.">
            {t.showDesktop && <DCArtboard id="c-d" label="Desktop · Today" width={1280} height={820}>
              <window.CPocketDesktop />
            </DCArtboard>}
            {t.showMobile && <DCArtboard id="c-m" label="Mobile · Home" width={390} height={760}>
              <window.CPocketMobile />
            </DCArtboard>}
          </DCSection>
        )}
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Focus on a direction">
          <TweakRadio value={t.focus} onChange={v => setTweak('focus', v)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'a',   label: 'A · Ledger' },
              { value: 'b',   label: 'B · Bank' },
              { value: 'd',   label: 'D · Pocket Bank' },
              { value: 'c',   label: 'C · Pocket' },
            ]} />
        </TweakSection>
        <TweakSection title="Language">
          <TweakRadio value={t.lang} onChange={v => setTweak('lang', v)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'th', label: 'ไทย' },
            ]} />
        </TweakSection>
        <TweakSection title="Platforms">
          <TweakRadio value={t.showDesktop && t.showMobile ? 'both' : t.showDesktop ? 'desktop' : 'mobile'}
            onChange={v => setTweak({
              showDesktop: v !== 'mobile',
              showMobile:  v !== 'desktop',
            })}
            options={[
              { value: 'both',    label: 'Both' },
              { value: 'desktop', label: 'Desktop' },
              { value: 'mobile',  label: 'Mobile' },
            ]} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
