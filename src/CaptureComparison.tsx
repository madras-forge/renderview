import type { Report } from '../shared/types';
import { ArrowRight, ClipboardList } from 'lucide-react';

function RequestUrl({ url }: { url: string }) {
  let label = url;
  try {
    const parsed = new URL(url);
    label = parsed.hostname + parsed.pathname;
  } catch {}
  return (
    <details className="request-url">
      <summary>{label}</summary>
      <code>{url}</code>
    </details>
  );
}

export function ScriptIssues({ report }: { report: Report }) {
  const scripts = report.incompleteScripts ?? [];
  return (
    <section className="script-issues" aria-label="Unfinished script requests">
      <h3>Unfinished script requests</h3>
      <p>Observed request states, not a classification of script purpose or SEO impact.</p>
      {scripts.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SCRIPT URL</th>
                <th>STATE</th>
                <th>ELAPSED</th>
                <th>RESPONSE</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s, i) => (
                <tr key={i}>
                  <td>
                    <RequestUrl url={s.url} />
                    <small>
                      Initiator: {s.initiator}
                      {s.error && ` · ${s.error}`}
                    </small>
                  </td>
                  <td>{s.state}</td>
                  <td>{s.duration} ms</td>
                  <td>{s.status ? `HTTP ${s.status}` : 'No headers received'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          {report.incompleteScripts
            ? 'No unfinished script requests were recorded.'
            : 'Request details are unavailable for this older capture. Run a new capture to collect them.'}
        </p>
      )}
    </section>
  );
}
export default function CaptureComparison({ report }: { report: Report }) {
  const c = report.comparison;
  if (!c) return null;
  return (
    <section className="comparison-panel" aria-label="Longer capture comparison">
      <div className="comparison-heading">
        <ClipboardList size={21} />
        <div>
          <div className="eyebrow">LONGER CAPTURE COMPARISON</div>
          <h2>{c.verdict}</h2>
        </div>
        <span>
          {c.before.windowMs / 1000}s <ArrowRight size={14} /> {c.after.windowMs / 1000}s
        </span>
      </div>
      <p className="comparison-next">
        <strong>Next step:</strong> {c.nextStep}
      </p>
      <p className="comparison-scope">
        Two fresh browser visits. Scripts are matched by exact URL; “not observed” does not mean
        resolved. Body text can include hidden UI.{' '}
        {c.sourceVaried && 'The source HTML differed between visits.'}
      </p>
      <div className="comparison-times">
        <span>
          First: {new Date(c.before.createdAt).toLocaleTimeString()} · HTTP {c.before.status}
        </span>
        <span>
          Longer: {new Date(c.after.createdAt).toLocaleTimeString()} · HTTP {c.after.status}
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>CONTENT</th>
              <th>FIRST CAPTURE</th>
              <th>LONGER CAPTURE</th>
              <th>RESULT</th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>
                  <details>
                    <summary>
                      {row.before[0]?.slice(0, 85) || 'Absent'}
                      {row.label !== 'Body text' &&
                        row.before.length > 1 &&
                        ` (+${row.before.length - 1})`}
                    </summary>
                    <pre>{row.before.join('\n\n') || 'Absent'}</pre>
                  </details>
                </td>
                <td>
                  <details>
                    <summary>
                      {row.after[0]?.slice(0, 85) || 'Absent'}
                      {row.label !== 'Body text' &&
                        row.after.length > 1 &&
                        ` (+${row.after.length - 1})`}
                    </summary>
                    <pre>{row.after.join('\n\n') || 'Absent'}</pre>
                  </details>
                </td>
                <td>
                  <span
                    className={`priority-badge ${row.changed === null ? 'unknown' : row.changed ? 'review' : 'stable'}`}
                  >
                    {row.changed === null ? 'Unknown' : row.changed ? 'Changed' : 'Unchanged'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {c.scriptRows.length > 0 && (
        <details className="script-comparison">
          <summary>Track unfinished script URLs across visits ({c.scriptRows.length})</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SCRIPT URL</th>
                  <th>FIRST CAPTURE</th>
                  <th>LONGER CAPTURE</th>
                </tr>
              </thead>
              <tbody>
                {c.scriptRows.map((s) => (
                  <tr key={s.url}>
                    <td>
                      <RequestUrl url={s.url} />
                    </td>
                    <td>{s.before}</td>
                    <td>{s.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
