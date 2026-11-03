import { describe, it, expect } from 'vitest';
import { extract, compare, words, bodyText } from '../server/extract.js';
describe('SEO extraction', () => {
  it('extracts actual HTML, ignores empty values, and handles attribute case', () => {
    const result = extract(
      '<title>A &amp; B</title><meta NAME="DESCRIPTION" content="An example"><link rel="alternate canonical" href="/a"><h1> Hello <em>world</em> </h1><a href="/ok">OK</a><a href="#x">X</a><a href="javascript:void(0)">No</a><script type="application/ld+json">{"@type":"Thing"}</script>',
    );
    expect(result.title).toEqual(['A & B']);
    expect(result.description).toEqual(['An example']);
    expect(result.canonical).toEqual(['/a']);
    expect(result.h1).toEqual(['Hello world']);
    expect(result.links).toEqual(['/ok']);
    expect(result.structuredData).toEqual(['{"@type":"Thing"}']);
  });
  it('distinguishes added, changed, removed and unchanged values', () => {
    const changes = compare(
      extract('<title>Before</title><h1>Gone</h1>'),
      extract('<title>After</title><meta name="description" content="New">'),
    );
    expect(changes.find((c) => c.field === 'title')?.status).toBe('changed');
    expect(changes.find((c) => c.field === 'h1')?.status).toBe('removed');
    expect(changes.find((c) => c.field === 'description')?.status).toBe('added');
    expect(changes.find((c) => c.field === 'canonical')?.status).toBe('unchanged');
  });
  it('does not count scripts, styles, or template content as body words', () => {
    expect(
      words(
        '<body>one two<script>many other words</script><style>more words</style><template>hidden words</template></body>',
      ),
    ).toBe(2);
  });
});

it('separates block text without merging neighboring words', () => {
  expect(
    bodyText(
      '<body><div>Home</div><div>Services</div><p>Book <strong>now</strong></p><br>Today</body>',
    ),
  ).toBe('Home Services Book now Today');
  expect(words('<div>Home</div><div>Services</div>')).toBe(2);
});
it('counts web-page hrefs rather than email, phone, or opaque links', () => {
  expect(
    extract(
      '<a href="mailto:test@example.com">Email</a><a href="tel:+123">Call</a><a href="data:text/plain,hello">Data</a><a href="/services">Services</a><a href="https://example.com">Web</a>',
    ).links,
  ).toEqual(['/services', 'https://example.com']);
});
