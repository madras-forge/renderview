import { useState } from 'react';
import {
  ArrowDownToLine,
  Square,
  ChevronDown,
  Clipboard,
  ExternalLink,
  Search,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { buildFindings, captureConcerns, developerHandoff, type Finding } from '../shared/findings';
import { ScriptIssues } from './CaptureComparison';
import type { Field, Report } from '../shared/types';

export default function ActionPlan({
  report,
  onInspect,
  onRetry,
  onCompare,
}: {
  report: Report;
  onInspect: (field: Field) => void;
  onRetry: () => void;
  onCompare: () => void;
}) {
  const findings = buildFindings(report);
  const concerns = captureConcerns(report);
  const [filter, setFilter] = useState<'all' | 'fix' | 'review'>('all');
  const [expanded, setExpanded] = useState<string | null>(findings[0]?.id ?? null);
  const [copyStatus, setCopyStatus] = useState('');
  const fixes = findings.filter((f) => f.priority === 'fix'),
    reviews = findings.filter((f) => f.priority === 'review');
  const shown = findings.filter((f) => filter === 'all' || filter === f.priority);
  const notes = report.warnings.filter((w) => !w.startsWith('Illustrative'));
  async function copy(finding: Finding) {
    try {
      await navigator.clipboard.writeText(developerHandoff(report, [finding]));
      setCopyStatus(`Copied: ${finding.title}`);
    } catch {
      setCopyStatus('Clipboard unavailable. Use Download action plan to save the handoff.');
    }
  }
  function download() {
    const blob = new Blob([developerHandoff(report, findings)], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renderview-actions-${report.id}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="action-plan" aria-label="Prioritized action plan">
      <div className="action-heading">
        <div>
          <div className="eyebrow">YOUR NEXT STEPS {report.sample && '· SAMPLE'}</div>
          <h2>
            {fixes.length
              ? `${fixes.length} ${fixes.length === 1 ? 'item needs' : 'items need'} attention first`
              : concerns.length
                ? report.comparison
                  ? 'Review the unresolved requests below'
                  : 'Verify this capture with a longer comparison'
                : reviews.length
                  ? 'Review captured differences and delivery'
                  : 'No differences or rule-triggered issues observed'}
          </h2>
          <p>
            {fixes.length
              ? 'Start with observed problems and confirm page intent before changing search visibility.'
              : concerns.length
                ? 'Resolve capture limitations before concluding that the page is unchanged. Pending scripts may or may not affect essential content.'
                : reviews.length
                  ? 'No urgent findings in these checks. These observations are not proof of an SEO failure.'
                  : `No findings were triggered within this ${report.observationMs / 1000}-second observation window. Delayed or interaction-dependent content can still be missed.`}
          </p>
        </div>
        <button className="secondary" onClick={download}>
          <ArrowDownToLine size={15} />
          Download action plan
        </button>
      </div>
      {!report.sample &&
        (report.observationMs < 10000 || concerns.length > 0 || !findings.length) && (
          <div className="capture-retry">
            <p>
              {report.observationMs < 10000
                ? 'Keep this capture as a baseline, then compare it with a fresh 10-second capture.'
                : 'Already captured for 10 seconds. Compare the intended page in a normal browser; more waiting does not guarantee completeness.'}
            </p>
            {report.observationMs < 10000 && (
              <button className="secondary" onClick={onRetry}>
                Run longer capture and compare
              </button>
            )}
          </div>
        )}
      {(concerns.length > 0 || (report.incompleteScripts?.length ?? 0) > 0) && (
        <ScriptIssues report={report} />
      )}
      <details className="coverage">
        <summary>What was checked in this capture</summary>
        <ul>
          {Object.entries(report.raw).map(([field, values]) => (
            <li key={field}>
              <strong>{field}</strong>
              <span>
                {values.length} source → {report.rendered[field as Field].length} rendered values
              </span>
            </li>
          ))}
        </ul>
        <p>
          Plus body-text differences, response status, JSON syntax, browser errors, and capture
          limitations. Missing optional metadata is not automatically a defect. This is not a
          complete SEO audit.
        </p>
      </details>
      {notes.length > 0 && (
        <div className="action-caveat" role="note">
          <AlertTriangle size={17} />
          <div>
            <strong>Interpret this capture with care</strong>
            {notes.map((note, i) => (
              <p key={i}>{note}</p>
            ))}
          </div>
        </div>
      )}
      <div className="action-filters" aria-label="Filter action priorities">
        {(['all', 'fix', 'review'] as const).map((value) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              const first = findings.find((f) => value === 'all' || f.priority === value);
              setExpanded(first?.id ?? null);
            }}
          >
            {value === 'all' ? 'All actions' : value === 'fix' ? 'Fix first' : 'Review'}
            <span>
              {value === 'all' ? findings.length : value === 'fix' ? fixes.length : reviews.length}
            </span>
          </button>
        ))}
        <span className="decision-note">
          <ShieldCheck size={14} /> Evidence-based guidance
        </span>
      </div>
      <div className="finding-list">
        {shown.map((finding) => {
          const open = expanded === finding.id;
          return (
            <article className={`finding ${finding.priority}`} key={finding.id}>
              <button
                className="finding-toggle"
                aria-expanded={open}
                aria-controls={`finding-${finding.id}`}
                onClick={() => {
                  setExpanded(open ? null : finding.id);
                  setCopyStatus('');
                }}
              >
                <span className="finding-symbol">
                  {finding.priority === 'fix' ? <AlertTriangle size={18} /> : <Search size={18} />}
                </span>
                <span className="finding-title">
                  <strong>{finding.title}</strong>
                  <small>
                    {finding.kind} · {finding.owner}
                  </small>
                </span>
                <span className={`priority-badge ${finding.priority}`}>
                  {finding.priority === 'fix' ? 'Fix first' : 'Review'}
                </span>
                <ChevronDown size={17} className={open ? 'rotated' : ''} />
              </button>
              {open && (
                <div className="finding-body" id={`finding-${finding.id}`}>
                  <div className="finding-evidence">
                    <div className="finding-label">WHAT WE OBSERVED</div>
                    <pre>{finding.evidence}</pre>
                    {finding.id === 'body-text-change' && (
                      <button className="evidence-button" onClick={onCompare}>
                        Open HTML comparison <ExternalLink size={13} />
                      </button>
                    )}
                    {finding.field && (
                      <button className="evidence-button" onClick={() => onInspect(finding.field!)}>
                        Inspect complete values <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                  <div className="finding-explanation">
                    <h3>Why it matters</h3>
                    <p>{finding.impact}</p>
                    <h3>What to do</h3>
                    <p className="recommended-action">{finding.action}</p>
                    <ol>
                      {finding.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <h3>How to verify the fix</h3>
                    <ul className="acceptance-list">
                      {finding.acceptance.map((step) => (
                        <li key={step}>
                          <Square size={14} />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="finding-footer">
                    <a href={finding.source} target="_blank" rel="noreferrer">
                      Google guidance <ExternalLink size={13} />
                    </a>
                    <button className="secondary" onClick={() => void copy(finding)}>
                      <Clipboard size={14} />
                      Copy developer issue
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {!shown.length && (
          <div className="action-empty">
            <ShieldCheck size={20} />
            <p>
              {filter === 'fix'
                ? 'No urgent findings from these checks. Review rendering dependencies before deciding whether to change the implementation.'
                : 'No actions in this category. Unchanged or missing optional elements do not automatically require work.'}
            </p>
          </div>
        )}
      </div>
      <div className="action-footnote">
        <span>
          Priorities describe what to investigate first. Timing and script size alone do not prove
          an SEO problem.
        </span>
        <span role="status" aria-live="polite">
          {copyStatus}
        </span>
      </div>
    </section>
  );
}
