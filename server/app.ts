import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from './analyze.js';
import { validateUrl } from './security.js';
export function createApp(runner: typeof analyze = analyze) {
  const app = express();
  let busy = false;
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'renderview' }));
  app.post('/api/analyze', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    let url: string;
    let wait: number;
    try {
      url = validateUrl(req.body?.url).href;
      wait = req.body?.observationMs ?? 3000;
      if (!Number.isInteger(wait) || wait < 1000 || wait > 10000)
        throw new Error('Observation window must be 1000–10000 ms.');
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
    if (busy) {
      res.setHeader('Retry-After', '10');
      res.status(429).json({ error: 'An analysis is already running. Please retry shortly.' });
      return;
    }
    busy = true;
    try {
      res.json(await runner(url, wait));
    } catch (e) {
      const message = (e as Error).message;
      console.error('Analysis failed:', message.slice(0, 300));
      res.status(502).json({
        error: /browserType.launch/.test(message)
          ? 'Chromium is unavailable. Run npm run browsers on the server.'
          : /Timeout|closed/.test(message)
            ? 'The page exceeded the analysis deadline. Try again or use a shorter observation window.'
            : message.slice(0, 350),
      });
    } finally {
      busy = false;
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client');
  app.use(express.static(staticDir));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res
        .status('status' in err ? Number(err.status) : 500)
        .json({ error: 'Invalid request body.' });
    },
  );
  return app;
}
