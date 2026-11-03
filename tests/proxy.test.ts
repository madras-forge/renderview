import { it, expect } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import { createEgressProxy } from '../server/proxy.js';
it('denies HTTP requests to metadata and local destinations at the actual proxy boundary', async () => {
  const proxy = await createEgressProxy();
  try {
    for (const target of [
      'http://169.254.169.254/computeMetadata/v1/',
      'http://127.0.0.1/',
      'http://[::ffff:127.0.0.1]/',
    ]) {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = http.request(proxy.url, { path: target }, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on('error', reject);
        req.end();
      });
      expect(status).toBe(403);
    }
  } finally {
    proxy.close();
  }
});
it('denies CONNECT tunnels to private addresses', async () => {
  const proxy = await createEgressProxy();
  try {
    const url = new URL(proxy.url);
    const reply = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(Number(url.port), url.hostname, () =>
        socket.write('CONNECT 10.0.0.1:443 HTTP/1.1\r\nHost: 10.0.0.1:443\r\n\r\n'),
      );
      socket.on('error', reject);
      socket.on('data', (chunk) => {
        resolve(chunk.toString());
        socket.destroy();
      });
    });
    expect(reply).toContain('403 Forbidden');
  } finally {
    proxy.close();
  }
});
