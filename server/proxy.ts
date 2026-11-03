// All browser HTTP(S) traffic crosses this proxy. DNS is validated and the
// resulting IP is pinned to the socket, avoiding validation/connect rebinding.
import http from 'node:http';
import net from 'node:net';
import type { Duplex } from 'node:stream';
import { resolvePublic, validateUrl } from './security.js';
export async function createEgressProxy() {
  const sockets = new Set<Duplex>();
  let requests = 0,
    bytes = 0,
    closed = false,
    blocked = 0;
  const warnings: string[] = [];
  const track = (socket: Duplex) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  };
  const quota = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 40 * 1024 * 1024 && !closed) {
      warnings.push('Network transfer limit reached; the capture may be incomplete.');
      close();
    }
  };
  const server = http.createServer(async (req, res) => {
    try {
      if (closed || ++requests > 300) {
        if (!closed) {
          warnings.push('Network request limit reached; the capture may be incomplete.');
          close();
        }
        throw new Error('Request limit');
      }
      const url = validateUrl(req.url);
      const dest = await resolvePublic(url.hostname);
      if (closed) return res.destroy();
      if (url.protocol !== 'http:') throw new Error('Use CONNECT for HTTPS');
      const headers: http.OutgoingHttpHeaders = { ...req.headers, host: url.host };
      delete headers['proxy-authorization'];
      delete headers['proxy-connection'];
      const upstream = http.request(
        {
          hostname: dest.address,
          port: url.port || 80,
          method: req.method,
          path: url.pathname + url.search,
          headers,
        },
        (response) => {
          res.writeHead(response.statusCode ?? 502, response.headers);
          response.on('data', quota);
          response.pipe(res);
        },
      );
      upstream.on('socket', track);
      upstream.setTimeout(20000, () => upstream.destroy());
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    } catch {
      blocked++;
      if (!res.destroyed) {
        res.writeHead(403);
        res.end('Destination blocked by renderview');
      }
    }
  });
  server.on('connect', async (req, client, head) => {
    track(client);
    try {
      if (closed || ++requests > 300) {
        if (!closed) {
          warnings.push('Network request limit reached; the capture may be incomplete.');
          close();
        }
        throw new Error('Request limit');
      }
      const url = validateUrl('https://' + req.url);
      const dest = await resolvePublic(url.hostname);
      if (closed) return client.destroy();
      const upstream = net.connect(Number(url.port || 443), dest.address);
      track(upstream);
      upstream.setTimeout(20000, () => upstream.destroy());
      upstream.on('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        upstream.on('data', quota);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.on('error', () => client.destroy());
      client.on('close', () => upstream.destroy());
    } catch {
      blocked++;
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    }
  });
  server.on('connection', track);
  function close() {
    closed = true;
    for (const s of sockets) s.destroy();
    server.close();
  }
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as net.AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close,
    get warnings() {
      return [
        ...warnings,
        ...(blocked ? [`${blocked} outbound request(s) were blocked by the network policy.`] : []),
      ];
    },
  };
}
