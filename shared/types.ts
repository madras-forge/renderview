export const fields = [
  'title',
  'description',
  'canonical',
  'robots',
  'h1',
  'links',
  'structuredData',
] as const;
export type Field = (typeof fields)[number];
export const labels: Record<Field, string> = {
  title: 'Page title',
  description: 'Meta description',
  canonical: 'Canonical URL',
  robots: 'Robots directive',
  h1: 'H1 headings',
  links: 'Crawlable links',
  structuredData: 'JSON-LD blocks',
};
export type Snapshot = Record<Field, string[]>;
export type Change = {
  field: Field;
  raw: string[];
  rendered: string[];
  status: 'unchanged' | 'added' | 'removed' | 'changed';
};
export type Arrival = { field: Field; at: number; value: string[] };
export type Script = {
  url: string;
  bytes: number;
  duration: number;
  start: number;
  thirdParty: boolean;
  initiator: string;
  status: number;
};
export type IncompleteScript = Script & { state: 'pending' | 'failed'; error?: string };
export type CaptureComparison = {
  before: { id: string; createdAt: string; windowMs: number; finalUrl: string; status: number };
  after: { id: string; createdAt: string; windowMs: number; finalUrl: string; status: number };
  comparable: boolean;
  sourceVaried: boolean;
  verdict: string;
  nextStep: string;
  rows: { label: string; before: string[]; after: string[]; changed: boolean | null }[];
  beforeWarnings: string[];
  afterWarnings: string[];
  scriptRows: { url: string; before: string; after: string }[];
};
export type Report = {
  id: string;
  url: string;
  finalUrl: string;
  createdAt: string;
  sample?: boolean;
  status: number;
  duration: number;
  observationMs: number;
  rawHtml: string;
  renderedHtml: string;
  raw: Snapshot;
  rendered: Snapshot;
  changes: Change[];
  timeline: Arrival[];
  scripts: Script[];
  incompleteScripts?: IncompleteScript[];
  comparison?: CaptureComparison;
  errors: string[];
  warnings: string[];
  headers: Record<string, string>;
  content?: {
    changed: boolean;
    rawPreview: string;
    renderedPreview: string;
    rawHash?: string;
    renderedHash?: string;
    textVersion?: string;
  };
  metrics: {
    dependent: number;
    changed: number;
    scriptBytes: number;
    rawWords: number;
    renderedWords: number;
  };
};
