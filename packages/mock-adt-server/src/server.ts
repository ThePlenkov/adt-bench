import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { AddressInfo } from 'node:net';

export interface MockState {
  classes: Map<string, { name: string; source: string; activated: boolean }>;
  /** increment-only counter for ADT HTTP stats */
  httpCalls: Map<string, number>;
}

export interface MockServer {
  url: string;
  port: number;
  close: () => Promise<void>;
  reset: () => void;
  state: MockState;
}

export interface StartOptions {
  /** pre-seeded classes (key = uppercase name) */
  initialClasses?: Array<{ name: string; source: string; activated?: boolean }>;
  /** port to bind; 0 picks a free port */
  port?: number;
}

/**
 * Minimal mock ADT server. Supports just enough endpoints for the v1 smoke
 * scenarios and the benchmark fixtures:
 *   - GET  /sap/bc/adt/discovery
 *   - GET  /sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=...&maxResults=...
 *   - GET  /sap/bc/adt/oo/classes/{name}/source/main
 *   - POST /sap/bc/adt/oo/classes
 *   - POST /sap/bc/adt/oo/classes/{name}?_action=LOCK&accessMode=MODIFY
 *   - POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK&lockHandle=...
 *   - PUT  /sap/bc/adt/oo/classes/{name}/source/main?lockHandle=...
 *   - POST /sap/bc/adt/activation?method=activate&preauditRequested=true
 *   - GET  /__mock/state
 *   - POST /__mock/reset
 *   - GET  /__mock/stats
 */
export function startMockAdt(opts: StartOptions = {}): Promise<MockServer> {
  const state: MockState = {
    classes: new Map(),
    httpCalls: new Map(),
  };

  function seed(override?: StartOptions) {
    const src = override ?? opts;
    state.classes.clear();
    for (const c of src.initialClasses ?? []) {
      state.classes.set(c.name.toUpperCase(), {
        name: c.name.toUpperCase(),
        source: c.source,
        activated: c.activated ?? true,
      });
    }
  }
  seed();

  const locks = new Map<string, string>(); // name -> lockHandle
  const csrfTokens = new Map<string, string>(); // session-ish -> token

  function bump(path: string) {
    state.httpCalls.set(path, (state.httpCalls.get(path) ?? 0) + 1);
  }

  function setCors(res: ServerResponse) {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'content-type,x-csrf-token,authorization');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  function send(res: ServerResponse, status: number, body: string, contentType: string) {
    res.statusCode = status;
    res.setHeader('content-type', contentType);
    res.setHeader('content-length', Buffer.byteLength(body).toString());
    res.end(body);
  }

  function sendJson(res: ServerResponse, status: number, obj: unknown) {
    send(res, status, JSON.stringify(obj, null, 2), 'application/json; charset=utf-8');
  }

  function maybeIssueCsrf(req: IncomingMessage, res: ServerResponse) {
    if (req.headers['x-csrf-token'] === 'Fetch') {
      const token = `csrf-${Math.random().toString(36).slice(2)}`;
      csrfTokens.set(token, '1');
      res.setHeader('x-csrf-token', token);
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const url = req.url ?? '/';
    const path = url.split('?')[0]!;
    bump(path);
    maybeIssueCsrf(req, res);

    // Admin endpoints
    if (path === '/__mock/reset' && req.method === 'POST') {
      seed({ initialClasses: [] });
      locks.clear();
      csrfTokens.clear();
      state.httpCalls.clear();
      return sendJson(res, 200, { ok: true });
    }
    if (path === '/__mock/state' && req.method === 'GET') {
      return sendJson(res, 200, {
        classes: Array.from(state.classes.values()).map((c) => ({
          name: c.name,
          activated: c.activated,
          source_length: c.source.length,
        })),
        locks: Array.from(locks.entries()).map(([name, h]) => ({ name, handle: h })),
      });
    }
    if (path === '/__mock/stats' && req.method === 'GET') {
      const byEndpoint: Record<string, number> = {};
      for (const [k, v] of state.httpCalls.entries()) byEndpoint[k] = v;
      return sendJson(res, 200, {
        total: state.httpCalls.size,
        by_endpoint: byEndpoint,
      });
    }

    // ADT endpoints
    if (path === '/sap/bc/adt/discovery' && req.method === 'GET') {
      return send(
        res,
        200,
        `<?xml version="1.0" encoding="UTF-8"?>
<app:service xmlns:app="http://www.w3.org/2007/app" xmlns:adtcore="http://www.sap.com/adt/core">
  <app:workspace>
    <app:collection id="oo-classes" href="/sap/bc/adt/oo/classes" adtcore:kind="oo-classes">
      <atom:title xmlns:atom="http://www.w3.org/2005/Atom">ABAP Classes</atom:title>
    </app:collection>
  </app:workspace>
</app:service>`,
        'application/xml; charset=utf-8'
      );
    }

    if (path === '/sap/bc/adt/repository/informationsystem/search' && req.method === 'GET') {
      const q = (url.match(/[?&]query=([^&]*)/)?.[1] ?? '').toUpperCase();
      const matches = Array.from(state.classes.values())
        .filter((c) => q === '' || c.name.includes(q.replace(/\*/g, '')))
        .slice(0, 50);
      const entries = matches
        .map(
          (c) => `<entry>
  <title>${c.name}</title>
  <id>urn:sap:object:class:${c.name.toLowerCase()}</id>
  <link href="/sap/bc/adt/oo/classes/${c.name.toLowerCase()}" rel="self"/>
</entry>`
        )
        .join('\n');
      return send(
        res,
        200,
        `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
${entries || '<entry><title>(no matches)</title></entry>'}
</feed>`,
        'application/atom+xml; charset=utf-8'
      );
    }

    // /sap/bc/adt/oo/classes/{name}/source/main  (GET, PUT)
    const srcMatch = path.match(/^\/sap\/bc\/adt\/oo\/classes\/([^/]+)\/source\/main$/);
    if (srcMatch) {
      const name = srcMatch[1]!.toUpperCase();
      if (req.method === 'GET') {
        const c = state.classes.get(name);
        if (!c) {
          return send(
            res,
            404,
            `<?xml version="1.0"?><exc:exception xmlns:exc="http://www.sap.com/abap/xml/exception">not found</exc:exception>`,
            'application/xml; charset=utf-8'
          );
        }
        return send(res, 200, c.source, 'text/plain; charset=utf-8');
      }
      if (req.method === 'PUT') {
        const body = await readBody(req);
        const handle = url.match(/[?&]lockHandle=([^&]*)/)?.[1];
        if (!handle || locks.get(name) !== handle) {
          return send(res, 409, 'lock mismatch', 'text/plain');
        }
        const c = state.classes.get(name) ?? { name, source: '', activated: false };
        c.source = body;
        c.activated = false;
        state.classes.set(name, c);
        return send(res, 204, '', 'text/plain');
      }
    }

    // /sap/bc/adt/oo/classes/{name}  (?_action=LOCK|UNLOCK)
    const classMatch = path.match(/^\/sap\/bc\/adt\/oo\/classes\/([^/]+)$/);
    if (classMatch && req.method === 'POST') {
      const name = classMatch[1]!.toUpperCase();
      const action = url.match(/[?&]_action=([^&]*)/)?.[1];
      if (action === 'LOCK') {
        const handle = `lock-${Math.random().toString(36).slice(2)}`;
        locks.set(name, handle);
        return send(
          res,
          200,
          `<?xml version="1.0"?>
<LOCK_ENTITY xmlns="http://www.sap.com/adt/locks"><LOCK_HANDLE>${handle}</LOCK_HANDLE></LOCK_ENTITY>`,
          'application/xml; charset=utf-8'
        );
      }
      if (action === 'UNLOCK') {
        const handle = url.match(/[?&]lockHandle=([^&]*)/)?.[1];
        if (handle && locks.get(name) === handle) locks.delete(name);
        return send(res, 204, '', 'text/plain');
      }
    }

    // POST /sap/bc/adt/oo/classes  (create)
    if (path === '/sap/bc/adt/oo/classes' && req.method === 'POST') {
      const body = await readBody(req);
      const m = body.match(/<adtcore:name>([^<]+)<\/adtcore:name>/);
      const name = (m?.[1] ?? '').toUpperCase();
      if (!name) return send(res, 400, 'missing name', 'text/plain');
      if (state.classes.has(name)) return send(res, 409, 'exists', 'text/plain');
      state.classes.set(name, { name, source: '', activated: false });
      res.setHeader('location', `/sap/bc/adt/oo/classes/${name.toLowerCase()}`);
      return send(res, 201, '', 'text/plain');
    }

    // POST /sap/bc/adt/activation
    if (path === '/sap/bc/adt/activation' && req.method === 'POST') {
      const body = await readBody(req);
      const names = Array.from(body.matchAll(/<adtcore:objectReference[^>]*adtcore:name="([^"]+)"/g)).map(
        (m) => m[1]!.toUpperCase()
      );
      const items = names.map((n) => {
        const c = state.classes.get(n);
        if (c) c.activated = true;
        return `<adtcore:objectStatus adtcore:objectType="CLAS" adtcore:objectName="${n}" activationStatus="activated"/>`;
      });
      return send(
        res,
        200,
        `<?xml version="1.0"?>
<adtcore:activationResult xmlns:adtcore="http://www.sap.com/adt/core" activationExecuted="true">
${items.join('\n')}
</adtcore:activationResult>`,
        'application/xml; charset=utf-8'
      );
    }

    // default
    return send(res, 404, `mock: no handler for ${req.method} ${path}`, 'text/plain');
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      console.error('mock-adt error', e);
      if (!res.headersSent) send(res, 500, String(e), 'text/plain');
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      const url = `http://127.0.0.1:${port}`;
      resolve({
        url,
        port,
        state,
        reset: () => {
          seed({ initialClasses: [] });
          locks.clear();
          csrfTokens.clear();
          state.httpCalls.clear();
        },
        close: () =>
          new Promise<void>((res2, rej2) => {
            server.close((err) => (err ? rej2(err) : res2()));
          }),
      });
    });
  });
}
