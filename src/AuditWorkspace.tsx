import { useRef, useState } from 'react';
import { buildFindings } from '../shared/findings';
import { compareFindings, duplicateMetadata, parseUrls, readReport } from '../shared/workspace';
import type { Report } from '../shared/types';

const storageKey = 'renderview.saved.v1';
function load(): Report[] {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]').map(readReport); } catch { return []; }
}
function exportFile(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Result = { url: string; report?: Report; error?: string };
export default function AuditWorkspace({ report, busy, setBusy, onOpen }: {
  report: Report; busy: boolean; setBusy: (v: boolean) => void; onOpen: (r: Report) => void;
}) {
  const [saved, setSaved] = useState<Report[]>(load);
  const [message, setMessage] = useState('');
  const [baselineId, setBaselineId] = useState('');
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState('');
  const [running, setRunning] = useState(false);
  const cancel = useRef(false);
  const active = useRef<AbortController | null>(null);
  const baseline = saved.find(r => r.id === baselineId);
  const comparison = baseline ? compareFindings(baseline, report) : null;
  const duplicates = duplicateMetadata(results.flatMap(r => r.report ? [r.report] : []));
  function persist(next: Report[]) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); return true; }
    catch { setMessage('Browser storage is full or unavailable. Export your report, or remove an older saved report and try again.'); return false; }
  }
  function save(r: Report) {
    if (saved.length >= 10 && !saved.some(s => s.id === r.id)) { setMessage('Ten reports are saved. Remove one before saving another.'); return; }
    if (persist([r, ...saved.filter(s => s.id !== r.id)])) setMessage('Report saved in this browser.');
  }
  async function runBatch() {
    let urls: string[];
    try { urls = parseUrls(input); } catch (e) { setMessage((e as Error).message); return; }
    setBusy(true); setRunning(true); setMessage(''); setResults([]); cancel.current = false;
    let completed = 0;
    try {
      for (const url of urls) {
        if (cancel.current) break;
        setProgress(`Checking ${completed + 1} of ${urls.length}: ${url}`);
        const controller = new AbortController(); active.current = controller;
        const timeout = setTimeout(() => controller.abort(), 50000);
        try {
          const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, observationMs: report.observationMs }), signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Analysis failed');
          const captured = readReport(data);
          setResults(prev => [...prev, { url, report: captured }]);
        } catch (e) {
          setResults(prev => [...prev, { url, error: controller.signal.aborted ? (cancel.current ? 'Cancelled' : 'Capture timed out') : (e as Error).message }]);
        } finally { clearTimeout(timeout); completed++; }
      }
    } finally {
      active.current = null; setBusy(false); setRunning(false);
      setProgress(`${cancel.current ? 'Stopped' : 'Finished'}: ${completed} of ${urls.length} URLs attempted.`);
    }
  }
  return <section className="audit-workspace" aria-label="Audit workspace">
    <div className="workspace-heading"><div><p className="eyebrow">AUDIT WORKSPACE</p><h2>Track changes. Verify the next release.</h2>
      <p>Save a baseline, check your key pages, and review what changed.</p></div>
      <button className="secondary" disabled={busy || report.sample} onClick={() => save(report)}>Save current report</button></div>
    <details><summary>Saved reports &amp; release comparison <span>{saved.length}/10 saved</span></summary>
      <p>Reports stay in this browser until removed or browser data is cleared. Export JSON for a portable backup.</p>
      <label className="import-report">Import report JSON <input type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        try {
          if (file.size > 10_000_000) throw new Error('Choose a report smaller than 10 MB.');
          const imported = readReport(JSON.parse(await file.text())); save(imported); onOpen(imported);
        } catch (error) { setMessage((error as Error).message); }
      }} /></label>
      {!saved.length && <p>No saved reports yet. Analyze a page, then save its report as your baseline.</p>}
      {saved.map(r => <div className="saved-report" key={r.id}><div><strong>{r.url}</strong><small>{new Date(r.createdAt).toLocaleString()} · {r.observationMs / 1000}s capture</small></div>
        <button className="secondary" disabled={busy} onClick={() => onOpen(r)}>Open</button>
        <button className="secondary" onClick={() => exportFile(r, `renderview-${r.id}.json`)}>Export JSON</button>
        <button className="secondary" onClick={() => persist(saved.filter(s => s.id !== r.id))}>Remove</button></div>)}
      <label>Compare current report with saved baseline<select value={baselineId} onChange={e => setBaselineId(e.target.value)}>
        <option value="">Choose baseline</option>{saved.filter(r => r.id !== report.id).map(r => <option key={r.id} value={r.id}>{r.url} · {new Date(r.createdAt).toLocaleString()}</option>)}
      </select></label>
      {comparison && baseline?.id !== report.id && <div className="release-comparison">
        <h3>Finding changes since baseline</h3><p>{baseline?.url} → {report.url}</p>
        <p>{comparison.reliable ? 'Matched page and capture windows. “No longer detected” means this check stopped triggering; confirm the intended fix.' : 'Different destinations, capture windows, errors, or incomplete captures: disappearing findings need verification before calling them fixed.'}</p>
        {!comparison.rows.length && <p>No findings in either report. This does not establish indexing or a complete SEO pass.</p>}
        {comparison.rows.map(({ finding, status }) => <details key={finding.id}><summary><span className="finding-status">{status}</span> {finding.title}</summary>
          <p>{finding.evidence}</p><p><strong>Next step:</strong> {finding.action}</p><p><strong>Owner:</strong> {finding.owner}</p>
          <ul>{finding.acceptance.map(a => <li key={a}>{a}</li>)}</ul></details>)}
        <button className="secondary" onClick={() => exportFile({ baseline: baseline?.url, current: report.url, comparison }, 'renderview-release-comparison.json')}>Export comparison</button>
      </div>}
    </details>
    <details><summary>Check multiple pages <span>Up to 10 URLs</span></summary>
      <p>Paste key landing pages, one per line. Each receives a fresh rendered audit using the current report’s {report.observationMs / 1000}s window. Pages run one at a time; failures do not stop the remaining checks.</p>
      <label>URLs to audit<textarea value={input} disabled={busy} onChange={e => setInput(e.target.value)} rows={4} placeholder={'https://example.com/\nhttps://example.com/services'} /></label>
      <button className="secondary" disabled={busy} onClick={() => void runBatch()}>Run page checks</button>
      {running && <button className="secondary" onClick={() => { cancel.current = true; active.current?.abort(); }}>Stop checks</button>}
      <p role="status">{progress}</p>
      {results.map(r => <div className="saved-report" key={r.url}><div><strong>{r.url}</strong><small>{r.error || `${buildFindings(r.report!).filter(f => f.priority === 'fix').length} fix · ${buildFindings(r.report!).filter(f => f.priority === 'review').length} review · HTTP ${r.report!.status}`}</small></div>
        {r.report && <button className="secondary" disabled={busy} onClick={() => onOpen(r.report!)}>View findings</button>}</div>)}
      {duplicates.length > 0 && <div><h3>Repeated metadata across checked pages</h3><p>Review whether these pages have distinct search intents before changing shared metadata.</p>
        {duplicates.map(d => <details key={d.field + d.value}><summary>Shared {d.field}: {d.value}</summary><ul>{d.urls.map(url => <li key={url}>{url}</li>)}</ul><p>Give distinct pages accurate, descriptive metadata. Recheck after deployment.</p></details>)}</div>}
      {!!results.length && <button className="secondary" onClick={() => exportFile({ results, duplicates }, 'renderview-page-checks.json')}>Export page checks</button>}
    </details>
    {message && <p role="status" className="workspace-message">{message}</p>}
  </section>;
}
