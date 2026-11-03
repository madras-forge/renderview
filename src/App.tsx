import { useEffect, useMemo, useState } from 'react';
import { diffLines } from 'diff';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  FileCode2,
  Globe2,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
  CircleHelp,
  Link2,
  AlertTriangle,
} from 'lucide-react';
import { fields, labels, type Report, type Field } from '../shared/types';
import { demo } from './demo';
import ActionPlan from './ActionPlan';
import AuditWorkspace from './AuditWorkspace';
import CaptureComparison from './CaptureComparison';
import { compareCaptures } from '../shared/capture-comparison';
import { buildFindings, captureConcerns } from '../shared/findings';
type Tab = 'Overview' | 'HTML comparison' | 'SEO timeline' | 'JavaScript';
const tabs: Tab[] = ['Overview', 'HTML comparison', 'SEO timeline', 'JavaScript'];
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const sec = (n: number) => `${(n / 1000).toFixed(2)}s`;
function download(data: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Badge({ status, absent = false }: { status: string; absent?: boolean }) {
  return (
    <span className={`badge ${absent ? 'absent' : status}`}>
      <span />
      {absent
        ? 'Absent in both'
        : ((
            {
              added: 'Added on render',
              changed: 'Changed',
              removed: 'Removed',
              unchanged: 'In source',
            } as Record<string, string>
          )[status] ?? status)}
    </span>
  );
}
export default function App() {
  const [report, setReport] = useState<Report>(demo),
    [tab, setTab] = useState<Tab>('Overview'),
    [url, setUrl] = useState(''),
    [windowMs, setWindowMs] = useState(3000),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [filter, setFilter] = useState('all'),
    [selected, setSelected] = useState<Field | null>(null),
    [history, setHistory] = useState<Report[]>([]),
    [help, setHelp] = useState(false),
    [nav, setNav] = useState(false),
    [search, setSearch] = useState(''),
    [onlyChanges, setOnlyChanges] = useState(false);
  useEffect(() => {
    if (!selected && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
        setHelp(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"] button, [role="dialog"] a, [role="dialog"] input, [role="dialog"] select, [role="dialog"] [tabindex="0"]',
        ),
      );
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, [selected, help]);
  const diffs = useMemo(
    () =>
      diffLines(report.rawHtml.replace(/></g, '>\n<'), report.renderedHtml.replace(/></g, '>\n<')),
    [report],
  );
  const maxTime = Math.max(
    1000,
    ...report.timeline.map((t) => t.at),
    ...report.scripts.map((s) => s.start + s.duration),
  );
  const changed = report.changes.filter((c) => c.status !== 'unchanged');
  const lastArrival = Math.max(
    0,
    ...report.timeline.filter((t) => t.value.length).map((t) => t.at),
  );
  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    await runAnalysis(url, windowMs);
  }
  async function runAnalysis(targetUrl: string, observationMs: number, baseline?: Report) {
    setError('');
    setBusy(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, observationMs }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed.');
      if (baseline) data.comparison = compareCaptures(baseline, data);
      setReport(data);
      setHistory((h) => [data, ...h].slice(0, 8));
      setTab('Overview');
      setSelected(null);
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'AbortError'
          ? 'Analysis timed out. Try again.'
          : e instanceof Error
            ? e.message
            : 'Unable to reach the analysis service.',
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  const changeRows = report.changes.filter(
    (c) =>
      (filter === 'all' ||
        (filter === 'changed' ? c.status !== 'unchanged' : c.status === 'added')) &&
      labels[c.field].toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${nav ? 'open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab('Overview');
          }}
        >
          <span className="brand-icon">
            <Code2 size={22} />
          </span>
          renderview<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">R</span>
          <div>
            My workspace<small>Technical SEO toolkit</small>
          </div>
          <span className="free">LOCAL</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {[
            {
              name: 'Page analyzer',
              icon: LayoutDashboard,
              action: () => {
                setTab('Overview');
                setNav(false);
              },
            },
            {
              name: 'HTML comparison',
              icon: FileCode2,
              action: () => {
                setTab('HTML comparison');
                setNav(false);
              },
            },
            {
              name: 'SEO timeline',
              icon: Activity,
              action: () => {
                setTab('SEO timeline');
                setNav(false);
              },
            },
            {
              name: 'JavaScript',
              icon: Braces,
              action: () => {
                setTab('JavaScript');
                setNav(false);
              },
            },
          ].map((item, i) => (
            <button
              key={item.name}
              className={tabs.indexOf(tab) === i ? 'active' : ''}
              onClick={item.action}
            >
              <item.icon size={18} />
              {item.name}
              {i === 0 && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="recent-title">
          <p className="nav-label">THIS SESSION</p>
          <span>{history.length}</span>
        </div>
        <div className="recent-list">
          {history.length ? (
            history.map((r) => (
              <button
                key={r.id}
                aria-label={`Open ${r.url}, ${r.observationMs / 1000}s capture, ${new Date(r.createdAt).toLocaleTimeString()}`}
                onClick={() => {
                  setReport(r);
                  setTab('Overview');
                  setSelected(null);
                  setNav(false);
                }}
              >
                <Globe2 size={15} />
                <span>
                  {new URL(r.url).hostname}
                  <small>
                    {r.observationMs / 1000}s · {new Date(r.createdAt).toLocaleTimeString()}
                    <br />
                    {new URL(r.url).pathname}
                  </small>
                </span>
                <ChevronRight size={13} />
              </button>
            ))
          ) : (
            <p>
              Your live analyses will
              <br />
              appear here.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="tip-icon">
            <Sparkles size={18} />
          </div>
          <strong>A little more visibility.</strong>
          <p>Find the content that only shows up after browser rendering.</p>
          <button onClick={() => setHelp(true)}>
            How renderview works <ArrowUpRight size={15} />
          </button>
        </div>
        <button className="help-link" onClick={() => setHelp(true)}>
          <CircleHelp size={17} /> Methodology & help
        </button>
        <div className="profile">
          <span>RV</span>
          <div>
            SEO workspace<small>Browser-based analysis</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle navigation"
              onClick={() => setNav(!nav)}
            >
              <Menu size={20} />
            </button>
            <span className="crumb">Workspace</span>
            <ChevronRight size={14} />
            <span>Page analyzer</span>
          </div>
          <button className="top-help" onClick={() => setHelp(true)}>
            <CircleHelp size={16} /> How it works <ArrowUpRight size={14} />
          </button>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> THE RENDERING INTELLIGENCE TOOLKIT
              </div>
              <h1>
                Compare source HTML <span>with the rendered page.</span>
              </h1>
              <p>Inspect content differences, capture limits, and recommended next steps.</p>
            </div>
            <span className="engine-label">
              <span /> Powered by Chromium
            </span>
          </div>
          <section className="analyze-card" aria-label="Analyze a URL">
            <form onSubmit={analyze}>
              <div className="url-input">
                <Globe2 size={20} />
                <input
                  type="url"
                  required
                  aria-label="Page URL"
                  placeholder="https://your-website.com/page"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={busy}
                />
              </div>
              <label className="wait-select">
                <Clock3 size={16} />
                <select
                  aria-label="Observation window"
                  value={windowMs}
                  onChange={(e) => setWindowMs(Number(e.target.value))}
                  disabled={busy}
                >
                  <option value={1000}>1s render window</option>
                  <option value={3000}>3s render window</option>
                  <option value={5000}>5s render window</option>
                  <option value={10000}>10s render window</option>
                </select>
              </label>
              <button className="primary" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <Zap size={17} />}{' '}
                {busy ? 'Analyzing…' : 'Analyze page'}
                {!busy && <ArrowRight size={16} />}
              </button>
            </form>
            <div className="form-foot">
              <span>
                <ShieldCheck size={14} /> Public URLs only · No login required on target pages
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setReport(demo);
                  setTab('Overview');
                  setSelected(null);
                  setError('');
                }}
              >
                Explore sample report <ArrowUpRight size={13} />
              </button>
            </div>
          </section>
          <AuditWorkspace report={report} busy={busy} setBusy={setBusy} onOpen={(r) => {
            setReport(r); setTab('Overview'); setSelected(null); setUrl(r.url);
          }} />
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {busy && (
            <div className="progress" role="status">
              <LoaderCircle size={18} className="spin" />
              <div>
                <strong>Opening a fresh Chromium session</strong>
                <span>
                  Capturing source, observing SEO changes, and tracing scripts. This can take up to
                  40 seconds.
                </span>
              </div>
            </div>
          )}
          <section
            className={`report ${busy ? 'loading-report' : ''}`}
            aria-label="Analysis report"
            aria-busy={busy}
          >
            <div className="report-heading">
              <div className="report-url">
                <div className="site-icon">
                  <Globe2 size={20} />
                </div>
                <div>
                  <div className="site-title">
                    {new URL(report.finalUrl).hostname}
                    <span className={`report-type ${report.sample ? '' : 'live'}`}>
                      {report.sample ? 'SAMPLE REPORT' : 'LIVE REPORT'}
                    </span>
                  </div>
                  <p>
                    {new URL(report.finalUrl).pathname}
                    <span>•</span>
                    <span className="status-code">
                      {report.status} {report.status < 400 ? 'response' : 'error'}
                    </span>
                    <span>•</span>
                    {report.sample
                      ? 'Illustrative data'
                      : new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  download(
                    JSON.stringify({ ...report, findings: buildFindings(report) }, null, 2),
                    `renderview-${report.id}.json`,
                    'application/json',
                  )
                }
              >
                <ArrowDownToLine size={15} /> Export report
              </button>
            </div>
            <CaptureComparison report={report} />
            <ActionPlan
              key={report.id}
              report={report}
              onInspect={setSelected}
              onRetry={() => {
                setUrl(report.url);
                setWindowMs(10000);
                void runAnalysis(report.url, 10000, report);
              }}
              onCompare={() => {
                setTab('HTML comparison');
                document.getElementById('report-tabs')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <div className="body-text-summary">
              Body text:{' '}
              <strong>
                {report.metrics.rawWords} source words → {report.metrics.renderedWords} rendered
                words
              </strong>
              <span>Text in the HTML body, not a visual-content or indexing assessment.</span>
            </div>
            <div className="measurement-heading">
              <h2>Capture evidence</h2>
              <p>Use these measurements to investigate the actions above.</p>
            </div>
            <div className="stat-grid">
              <Stat
                label="SEO ELEMENTS CHANGED"
                value={`${report.metrics.changed}`}
                suffix="/ 7"
                icon={<Layers3 size={17} />}
                detail={`${7 - report.metrics.changed} element groups unchanged`}
                tone="purple"
              />
              <Stat
                label="ADDED ON RENDER"
                value={`${report.metrics.dependent}`}
                suffix="groups"
                icon={<Code2 size={17} />}
                detail="Absent in source, present in DOM"
                tone="orange"
              />
              <Stat
                label="LAST SEO EVENT"
                value={sec(lastArrival)}
                icon={<Clock3 size={17} />}
                detail={`${sec(report.observationMs)} observation after DOM ready`}
                tone="blue"
              />
              <Stat
                label="JAVASCRIPT TRANSFER"
                value={kb(report.metrics.scriptBytes).split(' ')[0]}
                suffix="KB"
                icon={<Braces size={17} />}
                detail={`${report.scripts.length} completed script requests`}
                tone="green"
              />
            </div>
            <div id="report-tabs" className="tabs" role="tablist" aria-label="Report views">
              {tabs.map((t, i) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  id={`tab-${i}`}
                  aria-controls="report-panel"
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setSelected(null);
                  }}
                >
                  {t}
                  {i === 0 && <span>{changed.length}</span>}
                </button>
              ))}
              <span className="capture-note">
                <span />{' '}
                {captureConcerns(report).length ? 'Capture needs review' : 'Capture window ended'}
              </span>
            </div>
            <div id="report-panel" role="tabpanel" aria-labelledby={`tab-${tabs.indexOf(tab)}`}>
              {tab === 'Overview' && (
                <>
                  <div className="overview-grid">
                    <section className="panel" id="seo-table">
                      <div className="panel-head">
                        <div>
                          <h2>SEO element comparison</h2>
                          <p>The source of truth, side by side.</p>
                        </div>
                        <span className="subtle-tag">7 groups</span>
                      </div>
                      <div className="table-toolbar">
                        <div className="filter-pills">
                          {['all', 'changed', 'dependent'].map((f) => (
                            <button
                              key={f}
                              className={filter === f ? 'selected' : ''}
                              onClick={() => setFilter(f)}
                            >
                              {f === 'all'
                                ? 'All elements'
                                : f === 'changed'
                                  ? 'Changed'
                                  : 'Added on render'}
                            </button>
                          ))}
                        </div>
                        <label className="table-search">
                          <Search size={14} />
                          <input
                            aria-label="Filter SEO elements"
                            placeholder="Find element"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>ELEMENT</th>
                              <th>SOURCE</th>
                              <th>RENDERED</th>
                              <th>STATUS</th>
                              <th>
                                <span className="sr-only">Details</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {changeRows.map((c) => (
                              <tr key={c.field}>
                                <td>
                                  <span className="element-name">
                                    {c.field === 'links' ? (
                                      <Link2 size={15} />
                                    ) : c.field === 'structuredData' ? (
                                      <Braces size={15} />
                                    ) : (
                                      <Code2 size={15} />
                                    )}
                                    <button onClick={() => setSelected(c.field)}>
                                      {labels[c.field]}
                                    </button>
                                  </span>
                                </td>
                                <td>
                                  {c.raw.length ? (
                                    <span className="present">
                                      <Check size={13} />
                                      {['links', 'structuredData', 'h1'].includes(c.field)
                                        ? c.raw.length
                                        : 'Present'}
                                    </span>
                                  ) : (
                                    <span className="missing">—</span>
                                  )}
                                </td>
                                <td>
                                  <span className={c.rendered.length ? 'present' : 'missing'}>
                                    {c.rendered.length ? (
                                      <>
                                        <Check size={13} />
                                        {['links', 'structuredData', 'h1'].includes(c.field)
                                          ? c.rendered.length
                                          : 'Present'}
                                      </>
                                    ) : (
                                      '—'
                                    )}
                                  </span>
                                </td>
                                <td>
                                  <Badge
                                    status={c.status}
                                    absent={!c.raw.length && !c.rendered.length}
                                  />
                                </td>
                                <td>
                                  <button
                                    className="icon-button"
                                    aria-label={`Inspect ${labels[c.field]}`}
                                    onClick={() => setSelected(c.field)}
                                  >
                                    <ChevronRight size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!changeRows.length && (
                          <p className="empty-state">No elements match this filter.</p>
                        )}
                      </div>
                      <div className="panel-footer">
                        <span>
                          <span className="purple-dot" /> Click an element to inspect its values
                        </span>
                        <span>Source → rendered DOM</span>
                      </div>
                    </section>
                    <section className="panel arrival-card">
                      <div className="panel-head">
                        <div>
                          <h2>When content arrives</h2>
                          <p>First observed in the rendered DOM.</p>
                        </div>
                        <Activity size={18} />
                      </div>
                      <div className="arrival-chart">
                        {fields
                          .filter((f) => f !== 'links')
                          .map((f) => {
                            const first = report.timeline.find(
                              (t) => t.field === f && t.value.length,
                            );
                            return (
                              <button
                                className="arrival-row"
                                key={f}
                                onClick={() => setSelected(f)}
                              >
                                <span>{labels[f]}</span>
                                <div className="track">
                                  <i
                                    className={report.raw[f].length ? 'source-bar' : 'js-bar'}
                                    style={{
                                      width: first
                                        ? `${Math.max(3, (first.at / maxTime) * 100)}%`
                                        : '0%',
                                    }}
                                  />
                                </div>
                                <small>{first ? sec(first.at) : '—'}</small>
                              </button>
                            );
                          })}
                        <div className="chart-axis">
                          <span>0s</span>
                          <span>{sec(maxTime / 2)}</span>
                          <span>{sec(maxTime)}</span>
                        </div>
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i className="source-dot" />
                          In source
                        </span>
                        <span>
                          <i className="purple-dot" />
                          After rendering
                        </span>
                      </div>
                      <div className="arrival-note">
                        <Clock3 size={16} />
                        <p>
                          Timing is measured from navigation start. A later arrival can delay
                          discovery.
                        </p>
                      </div>
                      <button className="text-button" onClick={() => setTab('SEO timeline')}>
                        Explore full timeline <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                  <div className="bottom-grid">
                    <section className="panel mini-panel">
                      <span className="mini-icon">
                        <FileCode2 size={20} />
                      </span>
                      <div>
                        <h3>What changed in the HTML?</h3>
                        <p>Inspect additions, removals, and the full rendered markup.</p>
                      </div>
                      <button
                        aria-label="View HTML comparison"
                        className="icon-button"
                        onClick={() => setTab('HTML comparison')}
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </section>
                    <section className="panel mini-panel">
                      <span className="mini-icon green">
                        <Braces size={20} />
                      </span>
                      <div>
                        <h3>Follow the JavaScript</h3>
                        <p>
                          {report.scripts.filter((s) => s.thirdParty).length} cross-host scripts ·{' '}
                          {kb(report.metrics.scriptBytes)} transferred
                        </p>
                      </div>
                      <button
                        aria-label="View JavaScript dependency analysis"
                        className="icon-button"
                        onClick={() => setTab('JavaScript')}
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </section>
                  </div>
                </>
              )}
              {tab === 'HTML comparison' && (
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Source HTML → rendered DOM</h2>
                      <p>
                        Text diff with tag-boundary formatting. Browser serialization can also
                        produce differences.
                      </p>
                    </div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={onlyChanges}
                        onChange={(e) => setOnlyChanges(e.target.checked)}
                      />{' '}
                      Changes only
                    </label>
                  </div>
                  <div className="code-meta">
                    <span>
                      <i className="remove-dot" /> Removed from source
                    </span>
                    <span>
                      <i className="add-dot" /> Added to DOM
                    </span>
                    <div className="code-downloads">
                      <button onClick={() => download(report.rawHtml, 'source.html', 'text/plain')}>
                        Download source
                      </button>
                      <button
                        onClick={() => download(report.renderedHtml, 'rendered.html', 'text/plain')}
                      >
                        Download DOM
                      </button>
                    </div>
                  </div>
                  <div className="diff-view">
                    {diffs
                      .filter((d) => !onlyChanges || d.added || d.removed)
                      .map((d, i) => (
                        <pre
                          key={i}
                          className={d.added ? 'diff-add' : d.removed ? 'diff-remove' : 'diff-same'}
                        >
                          {d.value
                            .split('\n')
                            .filter((line, i, a) => line || i < a.length - 1)
                            .map((line, j) => (
                              <div key={j}>
                                <span>{d.added ? '+' : d.removed ? '−' : ' '}</span>
                                <code>{line}</code>
                              </div>
                            ))}
                        </pre>
                      ))}
                  </div>
                </section>
              )}
              {tab === 'SEO timeline' && (
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>SEO element arrival timeline</h2>
                      <p>
                        DOM mutations captured during this visit, including later updates and
                        removals.
                      </p>
                    </div>
                    <span className="subtle-tag">{report.timeline.length} events</span>
                  </div>
                  <div className="timeline-list">
                    {report.timeline.length ? (
                      report.timeline.map((t, i) => (
                        <button
                          className="timeline-event"
                          key={i}
                          onClick={() => setSelected(t.field)}
                        >
                          <span className="event-time">{sec(t.at)}</span>
                          <span className="event-dot" />
                          <div>
                            <strong>
                              {labels[t.field]}{' '}
                              <span>
                                {!t.value.length
                                  ? 'removed'
                                  : report.timeline.slice(0, i).some((p) => p.field === t.field)
                                    ? 'updated'
                                    : 'first observed'}
                              </span>
                            </strong>
                            <p>{t.value.join(' · ').slice(0, 180) || 'No value present'}</p>
                          </div>
                          <ChevronRight size={16} />
                        </button>
                      ))
                    ) : (
                      <p className="empty-state">No SEO elements were observed in this capture.</p>
                    )}
                  </div>
                </section>
              )}
              {tab === 'JavaScript' && (
                <>
                  <div className="insight-banner">
                    <div className="insight-symbol">
                      <Braces size={20} />
                    </div>
                    <div>
                      <strong>A request graph, with rendering evidence.</strong>
                      <p>
                        Initiators explain script loading. Timing alone does not prove which script
                        caused an SEO change.
                      </p>
                    </div>
                  </div>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Script dependencies</h2>
                        <p>
                          Completed external script requests · inline scripts are not included in
                          transfer totals.
                        </p>
                      </div>
                      <span className="subtle-tag">{kb(report.metrics.scriptBytes)}</span>
                    </div>
                    <div className="table-scroll">
                      <table className="script-table">
                        <thead>
                          <tr>
                            <th>SCRIPT / INITIATOR</th>
                            <th>HOST</th>
                            <th>TRANSFER</th>
                            <th>DURATION</th>
                            <th>HTTP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.scripts.map((s, i) => (
                            <tr key={i}>
                              <td>
                                <details>
                                  <summary>
                                    {new URL(s.url).pathname.split('/').pop() || s.url}
                                    <span>{new URL(s.url).hostname}</span>
                                  </summary>
                                  <p>
                                    <b>URL:</b> {s.url}
                                  </p>
                                  <p>
                                    <b>Initiated by:</b> {s.initiator}
                                  </p>
                                  <p>
                                    <b>Started:</b> {sec(s.start)} after navigation
                                  </p>
                                </details>
                              </td>
                              <td>
                                <span className={`host-badge ${s.thirdParty ? 'third' : ''}`}>
                                  {s.thirdParty ? 'Cross-host' : 'Same host'}
                                </span>
                              </td>
                              <td>{kb(s.bytes)}</td>
                              <td>{s.duration} ms</td>
                              <td>{s.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!report.scripts.length && (
                        <p className="empty-state">
                          No completed external script requests were captured.
                        </p>
                      )}
                    </div>
                  </section>
                  <section className="panel diagnostics">
                    <h2>Browser diagnostics</h2>
                    {report.errors.length ? (
                      report.errors.map((e, i) => <pre key={i}>{e}</pre>)
                    ) : (
                      <p>
                        <Check size={16} /> No uncaught JavaScript exceptions were captured.
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>
            {report.warnings.filter((w) => !w.startsWith('Illustrative')).length > 0 && (
              <div className="warnings">
                <strong>Capture notes</strong>
                {report.warnings
                  .filter((w) => !w.startsWith('Illustrative'))
                  .map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
              </div>
            )}
            <footer className="report-footer">
              <span>
                <ShieldCheck size={14} />{' '}
                {report.sample
                  ? 'Sample data · No live analysis has been run'
                  : 'Fresh browser session · No target credentials stored'}
              </span>
              <span>
                One capture. A clearer view. <span className="tiny-brand">renderview.</span>
              </span>
            </footer>
          </section>
        </main>
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${labels[selected]} details`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSelected(null);
            }}
          >
            <div className="panel-head">
              <div>
                <span className="eyebrow">ELEMENT INSPECTOR</span>
                <h2>{labels[selected]}</h2>
              </div>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close inspector"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="inspector-values">
              {(['raw', 'rendered'] as const).map((key) => (
                <div key={key}>
                  <h3>
                    {key === 'raw' ? 'Source HTML' : 'Rendered DOM'}{' '}
                    <span>{report[key][selected].length} values</span>
                  </h3>
                  <pre>{report[key][selected].join('\n\n') || 'Not present in this capture'}</pre>
                </div>
              ))}
            </div>
            <p className="modal-note">
              Values are captured literally. Relative URLs, whitespace, parser normalization, and
              value order can affect the comparison.
            </p>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="How renderview works"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setHelp(false);
            }}
          >
            <div className="panel-head">
              <h2>One page. Two perspectives.</h2>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close help"
                onClick={() => setHelp(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="help-content">
              <h3>01 · Capture the response</h3>
              <p>
                Read the HTML returned to Chromium on the main navigation. SEO values are extracted
                without executing that source.
              </p>
              <h3>02 · Watch the page render</h3>
              <p>
                A fresh desktop Chromium session observes SEO mutations from document creation until
                your selected window after DOMContentLoaded.
              </p>
              <h3>03 · Inspect the differences</h3>
              <p>
                Compare title, description, canonical, robots, H1 headings, links, and JSON-LD.
                Script initiators describe loading dependencies, not causal attribution.
              </p>
              <h3>Understand the limits</h3>
              <p>
                This is a rendering diagnostic, not a Googlebot simulator or an indexing verdict. No
                scrolling, consent clicks, or login is performed. Service workers are disabled.
                Reports remain in memory for this session; export JSON to keep one.
              </p>
              <p>
                “JS-dependent” means an entire element group was absent from the response but
                present in the DOM. “Cross-host” compares exact hostnames, not company ownership.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  suffix,
  icon,
  detail,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  detail: string;
  tone: string;
}) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <small>{suffix}</small>
      </div>
      <p>
        <span />
        {detail}
      </p>
    </div>
  );
}
