import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VrtInput, VrtMessagesProvider, en, evaluate, formatPriority, nl, vrt } from '../src';
import type { VrtMessages } from '../src';
import '../src/react/styles.css';
import './demo.css';

const LANGUAGES: Record<string, { name: string; messages: VrtMessages }> = {
  en: { name: 'English', messages: en },
  nl: { name: 'Nederlands', messages: nl },
};

const SAMPLES = [
  'cross_site_scripting_xss.stored.non_admin_to_anyone',
  'server_side_injection.sql_injection',
  'server_security_misconfiguration.fingerprinting_banner_disclosure',
  'cross_site_scripting_xss',
  'social_engineering',
  'cross_site_scripting_xss.nope',
  '',
];

function Demo() {
  const [value, setValue] = useState(SAMPLES[0]);
  const [language, setLanguage] = useState('en');
  const [showPriority, setShowPriority] = useState(true);
  const [allowPartial, setAllowPartial] = useState(false);
  const result = evaluate(value, { allowPartial });
  const messages = LANGUAGES[language].messages;

  return (
    <VrtMessagesProvider messages={messages}>
      <main>
        <h1>vrt-input</h1>
        <p className="hint">
          A React component and core for picking entries from Bugcrowd's Vulnerability Rating Taxonomy, VRT{' '}
          {vrt.version} ({vrt.releaseDate}). <a href="https://github.com/0xMattijs/vrt-input">Source on GitHub</a>
        </p>
        <div className="controls">
          <label>
            Component language{' '}
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, l]) => (
                <option key={code} value={code} lang={code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={showPriority} onChange={(e) => setShowPriority(e.target.checked)} /> Show
            priority
          </label>
          <label>
            <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} /> Allow
            partial
          </label>
        </div>
        <div className="samples">
          {SAMPLES.map((s) => (
            <button key={s} type="button" onClick={() => setValue(s)}>
              {s === '' ? '(empty)' : s.length > 40 ? s.slice(0, 40) + '…' : s}
            </button>
          ))}
        </div>
        <output>
          Value: <code>{value || '(empty)'}</code> · {result.valid ? 'valid' : 'not valid'}
          {result.valid && result.priority !== null && <> · {formatPriority(result.priority, messages)}</>}
        </output>

        <section>
          <h2>Menu</h2>
          <p className="hint">
            Click through the columns, or type to filter, such as "stored xss" or "idor". Arrow keys move through
            the columns.
          </p>
          <VrtInput value={value} onChange={setValue} showPriority={showPriority} allowPartial={allowPartial} />
        </section>

        <section>
          <h2>Dropdowns</h2>
          <p className="hint">
            <code>mode="dropdowns"</code>, bound to the same value as the menu above.
          </p>
          <VrtInput
            value={value}
            onChange={setValue}
            mode="dropdowns"
            showPriority={showPriority}
            allowPartial={allowPartial}
          />
        </section>
      </main>
    </VrtMessagesProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
