// feedback:begin (managed by hub/scripts/feedback/backfill.mjs)
import { mountFeedback } from './feedback';
mountFeedback();
// feedback:end

import './styles.css';
import { loadDataset } from './data';
import { initTooltip } from './components/tooltip';
import { initGlossary } from './components/glossary';
import { initDrilldown, openDrilldown, closeDrilldown } from './drilldown';
import { initAbout, openAbout } from './about';
import { esc, type AppContext, type View } from './app';
import { rankingsView } from './views/rankings';
import { explorerView } from './views/explorer';
import { hierarchyView } from './views/hierarchy';
import { scatterView } from './views/scatter';
import { moversView } from './views/movers';
import { trendsView } from './views/trends';
import { whoPaysView } from './views/whopays';
import { insightsView } from './views/insights';
import { count, money } from './format';
import { titleCase } from './analysis';
import type { Dataset } from './types';

const VIEWS: View[] = [
  rankingsView,
  explorerView,
  hierarchyView,
  scatterView,
  moversView,
  trendsView,
  whoPaysView,
  insightsView,
];

const PREF_KEY = 'au-medicines.prefs';

function loadPrefs(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function savePrefs(prefs: Record<string, unknown>): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* private browsing — preferences simply do not persist */
  }
}

function shell(): string {
  return `
    <header class="site-header">
      <a class="wordmark" href="#" data-home>
        <svg viewBox="0 0 32 32" aria-hidden="true" class="mark">
          <g transform="rotate(-45 16 16)">
            <rect x="9" y="5.5" width="14" height="21" rx="7" fill="currentColor"/>
            <path d="M9 16h14v3.5a7 7 0 0 1-7 7 7 7 0 0 1-7-7z" fill="#5eead4"/>
          </g>
        </svg>
        <span>Prescription Medicines</span>
      </a>
      <nav class="tabs" aria-label="Views">
        ${VIEWS.map((v) => `<button type="button" data-view="${v.id}">${esc(v.label)}</button>`).join('')}
      </nav>
      <div class="header-actions">
        <div class="header-search">
          <input type="search" data-quick placeholder="Find a medicine…" aria-label="Find a medicine" autocomplete="off" />
          <ul class="quick-results" role="listbox" hidden></ul>
        </div>
        <button type="button" class="icon-btn" data-about aria-label="About this site and data">?</button>
      </div>
    </header>
    <main class="main-content">
      <div class="view-intro"><p data-blurb></p></div>
      <div class="view-host" data-host></div>
    </main>
    <footer class="site-footer">
      <div class="footer-inner">
        <p class="footer-data" data-footer-stats></p>
        <p>
          Source: <a href="https://www.pbs.gov.au/statistics/dos-and-dop/dos-and-dop" target="_blank" rel="noopener">PBS date of
          supply statistics</a>, Department of Health, Disability and Ageing. Dispensing data only — not medical advice.
        </p>
        <p>Built by <a href="https://benrichardson.dev/">benrichardson.dev</a> ·
          <a href="https://sites.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a></p>
      </div>
    </footer>
  `;
}

function boot(data: Dataset): void {
  const app = document.getElementById('app')!;
  app.innerHTML = shell();

  const host = app.querySelector<HTMLElement>('[data-host]')!;
  const blurb = app.querySelector<HTMLElement>('[data-blurb]')!;
  const prefs = loadPrefs();

  initTooltip();
  initGlossary();
  initDrilldown();
  initAbout(data.meta);

  const ctx: AppContext = {
    data,
    openDrug(id) {
      history.replaceState(null, '', `#drug=${id}`);
      void openDrilldown(id, data);
    },
    setView(id) {
      setView(id);
    },
    pref<T>(key: string, fallback: T): T {
      return (prefs[key] as T) ?? fallback;
    },
    setPref(key, value) {
      prefs[key] = value;
      savePrefs(prefs);
    },
  };

  let current = '';
  function setView(id: string): void {
    const view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
    current = view.id;
    prefs['view'] = view.id;
    savePrefs(prefs);
    app.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      const active = btn.dataset.view === view.id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });
    blurb.textContent = view.blurb;
    host.innerHTML = '';
    view.render(host, ctx);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  app.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) =>
    btn.addEventListener('click', () => setView(btn.dataset.view!)),
  );
  app.querySelector('[data-about]')?.addEventListener('click', openAbout);
  app.querySelector('[data-home]')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeDrilldown();
    setView(VIEWS[0].id);
  });

  // Header quick-search jumps straight to a medicine from any view.
  const quick = app.querySelector<HTMLInputElement>('[data-quick]')!;
  const results = app.querySelector<HTMLUListElement>('.quick-results')!;
  let debounce = 0;
  const closeQuick = () => {
    results.hidden = true;
    results.innerHTML = '';
  };
  quick.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      const q = quick.value.trim().toLowerCase();
      if (q.length < 2) return closeQuick();
      const matches = data.drugs
        .filter((d) => d.name.toLowerCase().includes(q))
        .sort((a, b) => {
          const ai = a.name.toLowerCase().indexOf(q);
          const bi = b.name.toLowerCase().indexOf(q);
          return ai - bi || b.total - a.total;
        })
        .slice(0, 8);
      if (!matches.length) {
        results.hidden = false;
        results.innerHTML = '<li class="quick-empty">No medicine matches that name.</li>';
        return;
      }
      results.hidden = false;
      results.innerHTML = matches
        .map(
          (d) =>
            `<li><button type="button" data-drug="${esc(d.id)}" role="option">
               <span>${esc(titleCase(d.name))}</span><em>${esc(money(d.total))}</em></button></li>`,
        )
        .join('');
      results.querySelectorAll<HTMLButtonElement>('[data-drug]').forEach((btn) =>
        btn.addEventListener('click', () => {
          ctx.openDrug(btn.dataset.drug!);
          quick.value = '';
          closeQuick();
        }),
      );
    }, 300);
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as Element)?.closest?.('.header-search')) closeQuick();
  });
  quick.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQuick();
  });

  app.querySelector<HTMLElement>('[data-footer-stats]')!.textContent =
    `${count(data.meta.totals.scripts)} prescriptions · ${data.meta.drugCount.toLocaleString('en-AU')} medicines · ` +
    `${money(data.meta.totals.govt)} government · ${money(data.meta.totals.patient)} patients · ` +
    `${data.meta.monthLabels[0]} – ${data.meta.monthLabels.at(-1)}`;

  window.addEventListener('hashchange', () => {
    const match = /^#drug=(.+)$/.exec(location.hash);
    if (match && data.byId.has(match[1])) void openDrilldown(match[1], data);
  });

  setView(typeof prefs['view'] === 'string' ? (prefs['view'] as string) : VIEWS[0].id);
  void current;

  const deepLink = /^#drug=(.+)$/.exec(location.hash);
  if (deepLink && data.byId.has(deepLink[1])) void openDrilldown(deepLink[1], data);
}

function showError(message: string): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="boot-error" role="alert">
      <h1>Prescription Medicines</h1>
      <p>${esc(message)}</p>
      <button type="button" class="btn" onclick="location.reload()">Try again</button>
    </div>
  `;
}

function showLoading(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="boot-loading" aria-busy="true" aria-live="polite">
      <div class="boot-mark"></div>
      <p>Loading six years of PBS dispensing data…</p>
    </div>
  `;
}

showLoading();
loadDataset()
  .then(boot)
  .catch((err: unknown) => {
    showError(
      err instanceof Error
        ? `The dispensing data could not be loaded (${err.message}). This is usually temporary.`
        : 'The dispensing data could not be loaded. This is usually temporary.',
    );
  });
