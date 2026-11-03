import * as cheerio from 'cheerio';
import { fields, type Snapshot, type Change } from '../shared/types.js';
export function extract(html: string): Snapshot {
  const $ = cheerio.load(html);
  const text = (selector: string) =>
    $(selector)
      .toArray()
      .map((el) => $(el).text().trim())
      .filter(Boolean);
  const attr = (selector: string, name: string) =>
    $(selector)
      .toArray()
      .map((el) => $(el).attr(name)?.trim() ?? '')
      .filter(Boolean);
  return {
    title: text('title'),
    description: attr('meta[name="description" i]', 'content'),
    canonical: attr('link[rel~="canonical" i]', 'href'),
    robots: attr('meta[name="robots" i]', 'content'),
    h1: text('h1'),
    links: attr('a[href]', 'href').filter(
      (v) => !/^\s*(?:#|(?!https?:)[a-z][a-z0-9+.-]*:)/i.test(v),
    ),
    structuredData: text('script[type="application/ld+json" i]'),
  };
}
export function compare(raw: Snapshot, rendered: Snapshot): Change[] {
  return fields.map((field) => ({
    field,
    raw: raw[field],
    rendered: rendered[field],
    status:
      JSON.stringify(raw[field]) === JSON.stringify(rendered[field])
        ? 'unchanged'
        : !raw[field].length
          ? 'added'
          : !rendered[field].length
            ? 'removed'
            : 'changed',
  }));
}
export function bodyText(html: string) {
  const $ = cheerio.load(html);
  $('script,style,noscript,template').remove();
  // Block boundaries must not merge adjacent words (e.g. </div><div>).
  $(
    'address,article,aside,blockquote,div,dl,dt,dd,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,ol,p,pre,section,table,td,th,tr,ul,br',
  ).each((_i, el) => {
    $(el).prepend(' ');
    $(el).append(' ');
  });
  return $('body').text().replace(/\s+/g, ' ').trim();
}

export function words(html: string) {
  return bodyText(html).split(/\s+/).filter(Boolean).length;
}
