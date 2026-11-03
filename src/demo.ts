import { fields, type Report, type Snapshot } from '../shared/types';
const raw: Snapshot = {
  title: ['Fieldnotes — Tools for thoughtful work'],
  description: [],
  canonical: ['https://fieldnotes.example/'],
  robots: ['index, follow'],
  h1: [],
  links: ['/about', '/journal'],
  structuredData: [],
};
const rendered: Snapshot = {
  ...raw,
  description: [
    'A calmer place for your best ideas. Discover notebooks, desk essentials, and tools for thoughtful work.',
  ],
  h1: ['Make room for your next great idea.'],
  links: ['/about', '/journal', '/shop', '/collections/notebooks', '/collections/desk', '/contact'],
  structuredData: ['{"@context":"https://schema.org","@type":"Organization","name":"Fieldnotes"}'],
};
export const demo: Report = {
  id: 'sample-fieldnotes',
  sample: true,
  url: 'https://fieldnotes.example/',
  finalUrl: 'https://fieldnotes.example/',
  createdAt: '2026-11-02T09:30:00.000Z',
  status: 200,
  duration: 3420,
  observationMs: 3000,
  raw,
  rendered,
  rawHtml:
    '<!doctype html>\n<html lang="en">\n<head>\n  <title>Fieldnotes — Tools for thoughtful work</title>\n  <link rel="canonical" href="https://fieldnotes.example/">\n  <meta name="robots" content="index, follow">\n</head>\n<body>\n  <div id="app"></div>\n  <a href="/about">About</a>\n  <a href="/journal">Journal</a>\n  <script src="/assets/app.js"></script>\n</body>\n</html>',
  renderedHtml:
    '<!doctype html>\n<html lang="en">\n<head>\n  <title>Fieldnotes — Tools for thoughtful work</title>\n  <link rel="canonical" href="https://fieldnotes.example/">\n  <meta name="robots" content="index, follow">\n  <meta name="description" content="A calmer place for your best ideas. Discover notebooks, desk essentials, and tools for thoughtful work.">\n</head>\n<body>\n  <div id="app">\n    <h1>Make room for your next great idea.</h1>\n    <a href="/shop">Shop all</a>\n    <a href="/collections/notebooks">Notebooks</a>\n    <a href="/collections/desk">Desk essentials</a>\n    <a href="/contact">Contact</a>\n  </div>\n  <a href="/about">About</a>\n  <a href="/journal">Journal</a>\n  <script src="/assets/app.js"></script>\n  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Fieldnotes"}</script>\n</body>\n</html>',
  changes: fields.map((field) => ({
    field,
    raw: raw[field],
    rendered: rendered[field],
    status:
      JSON.stringify(raw[field]) === JSON.stringify(rendered[field])
        ? 'unchanged'
        : !raw[field].length
          ? 'added'
          : 'changed',
  })),
  timeline: [
    { field: 'title', at: 82, value: raw.title },
    { field: 'canonical', at: 84, value: raw.canonical },
    { field: 'robots', at: 85, value: raw.robots },
    { field: 'links', at: 108, value: raw.links },
    { field: 'h1', at: 824, value: rendered.h1 },
    { field: 'links', at: 838, value: rendered.links },
    { field: 'description', at: 1142, value: rendered.description },
    { field: 'structuredData', at: 1680, value: rendered.structuredData },
  ],
  scripts: [
    {
      url: 'https://fieldnotes.example/assets/runtime.js',
      bytes: 12400,
      duration: 68,
      start: 115,
      thirdParty: false,
      initiator: 'parser',
      status: 200,
    },
    {
      url: 'https://fieldnotes.example/assets/vendor.js',
      bytes: 164000,
      duration: 244,
      start: 136,
      thirdParty: false,
      initiator: 'parser',
      status: 200,
    },
    {
      url: 'https://fieldnotes.example/assets/app.js',
      bytes: 84200,
      duration: 188,
      start: 380,
      thirdParty: false,
      initiator: 'https://fieldnotes.example/assets/runtime.js',
      status: 200,
    },
    {
      url: 'https://analytics.example/collect.js',
      bytes: 31600,
      duration: 290,
      start: 620,
      thirdParty: true,
      initiator: 'https://fieldnotes.example/assets/app.js',
      status: 200,
    },
  ],
  errors: [],
  warnings: ['Illustrative sample data. Run an analysis to measure a real page.'],
  headers: { 'content-type': 'text/html; charset=utf-8' },
  metrics: { dependent: 3, changed: 4, scriptBytes: 292200, rawWords: 2, renderedWords: 17 },
};
