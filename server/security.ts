import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
export function isPublicIp(address: string): boolean {
  try {
    const ip = ipaddr.process(address);
    return ip.range() === 'unicast';
  } catch {
    return false;
  }
}
export function validateUrl(input: unknown): URL {
  if (typeof input !== 'string' || input.length > 2048)
    throw new Error('Enter a valid public HTTP or HTTPS URL.');
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Enter a full URL starting with https://.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    !['', '80', '443'].includes(url.port)
  )
    throw new Error('Only HTTP(S) URLs on ports 80 or 443 without credentials are supported.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  )
    throw new Error('Local and internal destinations are blocked.');
  if (ipaddr.isValid(host) && !isPublicIp(host))
    throw new Error('Private and reserved addresses are blocked.');
  url.hash = '';
  return url;
}
export async function resolvePublic(host: string) {
  host = host.replace(/^\[|\]$/g, '');
  const results = await dns.lookup(host, { all: true });
  if (!results.length || results.some((x) => !isPublicIp(x.address)))
    throw new Error('Destination resolves to a private or reserved address.');
  return results[0];
}
