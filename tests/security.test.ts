import { describe, it, expect, vi } from 'vitest';
import dns from 'node:dns/promises';
import { validateUrl, isPublicIp, resolvePublic } from '../server/security.js';
describe('destination policy', () => {
  it.each([
    'file:///etc/passwd',
    'ftp://example.com',
    'http://127.0.0.1',
    'http://127.1',
    'http://2130706433',
    'http://0x7f000001',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://169.254.169.254',
    'http://localhost',
    'http://host.local',
    'http://metadata.google.internal',
    'https://user:pass@example.com',
    'https://example.com:8443',
  ])('blocks %s', (url) => expect(() => validateUrl(url)).toThrow());
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '172.16.0.2',
    '192.168.1.1',
    '100.64.0.1',
    '224.0.0.1',
    '192.0.2.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '::ffff:10.0.0.1',
  ])('rejects non-public IP %s', (ip) => expect(isPublicIp(ip)).toBe(false));
  it('permits public destinations and strips fragments', () => {
    expect(validateUrl('https://example.com/path?q=1#anchor').href).toBe(
      'https://example.com/path?q=1',
    );
    expect(isPublicIp('8.8.8.8')).toBe(true);
  });
  it('rejects a hostname if any DNS answer is private', async () => {
    const mock = vi.spyOn(dns, 'lookup').mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ] as never);
    try {
      await expect(resolvePublic('mixed.example')).rejects.toThrow('private');
    } finally {
      mock.mockRestore();
    }
  });
});
