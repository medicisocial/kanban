import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { loadEnv } from 'vite';

function readJsonBody(req) {
  return new Promise((resolveBody) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        resolveBody(null);
      }
    });
    req.on('error', () => resolveBody(null));
  });
}

function createMockResponse(res) {
  let statusCode = 200;
  const headers = {};

  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(key, value) {
      headers[key] = value;
      return this;
    },
    json(payload) {
      res.statusCode = statusCode;
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
    },
  };
}

function applyEnv(envDir, mode) {
  const env = loadEnv(mode, envDir, '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Serve /api/* from api/*.js during `vite` dev (matches Vercel serverless routes). */
export function localApiPlugin() {
  let envApplied = false;

  return {
    name: 'medici-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] || '';
        if (!pathname.startsWith('/api/')) {
          next();
          return;
        }

        if (!envApplied) {
          applyEnv(server.config.envDir, server.config.mode);
          envApplied = true;
        }

        const route = pathname.slice('/api/'.length);
        if (!route || route.includes('/') || route.includes('..')) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        const handlerPath = resolve(server.config.root, 'api', `${route}.js`);
        if (!existsSync(handlerPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'API route not found.' }));
          return;
        }

        try {
          const body =
            req.method === 'GET' || req.method === 'HEAD'
              ? {}
              : await readJsonBody(req);

          if (body === null) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
          }

          const mod = await import(pathToFileURL(handlerPath).href);
          const handler = mod.default;
          if (typeof handler !== 'function') {
            throw new Error(`No default export in api/${route}.js`);
          }

          const mockReq = {
            method: req.method,
            headers: req.headers,
            url: req.url,
            body,
          };

          await handler(mockReq, createMockResponse(res));
        } catch (error) {
          console.error(`[local-api] ${pathname}:`, error);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error: 'Local API error. Check the terminal for details.',
              }),
            );
          }
        }
      });
    },
  };
}
