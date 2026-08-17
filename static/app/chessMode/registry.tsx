/**
 * Chess mode — the Pawn Patrol interception layer.
 *
 * The app runs with no backend. Every request made through `sentry/api`'s
 * `Client` is routed here instead of the network. Domain modules under
 * `./domains/*.tsx` each default-export an array of `ChessRoute`s; the first
 * route whose method + url match wins.
 *
 * Unmatched requests never reach the network. They resolve to an empty 200 and
 * are logged (and recorded on `window.__chessUnmatched`) so gaps are visible.
 */

/**
 * A single stubbed endpoint.
 *
 * `url` is tested against the API path (with the `/api/0` prefix stripped, but
 * with the query string intact) *and* against the raw request url, so a regex
 * may be written either way.
 *
 * `handler` returns the JSON body to respond with, or a `chessResponse(...)`
 * wrapper when a non-200 status or response headers (e.g. pagination `Link`)
 * are needed. It may be async.
 *
 * `method` is matched case-insensitively. Omit it to match any method.
 */
export type ChessRoute = {
  handler: (url: string, options: any) => any;
  url: RegExp;
  method?: string;
};

/**
 * Chess mode is unconditionally on in this branch — there is no backend to
 * fall back to.
 */
export const CHESS_MODE_ENABLED = true;

type ChessResponseInit = {
  headers?: Record<string, string>;
  status?: number;
};

type ChessResponseBody = ChessResponseInit & {
  __chessResponse: true;
  body: any;
};

/**
 * Wrap a handler's return value when it needs a status code or headers.
 *
 *   return chessResponse(games, {headers: {Link: nextPageLink}});
 *   return chessResponse({detail: 'Not found'}, {status: 404});
 */
export function chessResponse(
  body: any,
  init: ChessResponseInit = {}
): ChessResponseBody {
  return {__chessResponse: true, body, ...init};
}

function isChessResponse(value: any): value is ChessResponseBody {
  return !!value && typeof value === 'object' && value.__chessResponse === true;
}

const domainContext = require.context('./domains', false, /\.tsx$/);

/**
 * `core.tsx` owns the broad catch-alls (`/organizations/`, `/projects/`, ...)
 * so it has to be consulted last or it would shadow the specific domains.
 */
function domainPriority(key: string) {
  return key.includes('core') ? 1 : 0;
}

/** A route plus the domain file it came from, for debugging collisions. */
type LoadedRoute = ChessRoute & {source: string};

let cachedRoutes: LoadedRoute[] | null = null;

function getRoutes(): LoadedRoute[] {
  if (cachedRoutes) {
    return cachedRoutes;
  }

  const routes: LoadedRoute[] = [];
  const keys = domainContext
    .keys()
    .sort((a, b) => domainPriority(a) - domainPriority(b) || a.localeCompare(b));

  for (const key of keys) {
    try {
      const domain = domainContext(key) as {default?: ChessRoute[]};
      if (Array.isArray(domain?.default)) {
        routes.push(...domain.default.map(route => ({...route, source: key})));
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[chessMode] ${key} has no default-exported ChessRoute[]`);
      }
    } catch (err) {
      // A broken domain module must not take down the whole app.
      // eslint-disable-next-line no-console
      console.error(`[chessMode] failed to load domain ${key}`, err);
    }
  }

  cachedRoutes = routes;
  // eslint-disable-next-line no-console
  console.info(
    `[chessMode] loaded ${routes.length} routes from ${keys.length} domains: ${keys.join(', ')}`
  );

  return routes;
}

/**
 * Reduce a request url to the API path used for matching:
 * strips the origin, the hybrid-cloud `/region/<name>` prefix and `/api/0`.
 */
function toApiPath(url: string) {
  let path = url;

  if (/^https?:\/\//.test(path)) {
    try {
      const parsed = new URL(path);
      path = parsed.pathname + parsed.search;
    } catch {
      // Leave it be, the regexes will simply not match.
    }
  }

  path = path.replace(/^\/region\/[^/]+/, '');
  path = path.replace(/^\/api\/0/, '');

  return path;
}

const unmatchedSeen = new Set<string>();

function recordUnmatched(method: string, apiPath: string) {
  const key = `${method} ${apiPath.split('?')[0]}`;
  if (unmatchedSeen.has(key)) {
    return;
  }
  unmatchedSeen.add(key);

  const bucket = ((window as any).__chessUnmatched ??= []);
  bucket.push(key);

  // eslint-disable-next-line no-console
  console.warn(`[chessMode] UNMATCHED ${method} ${apiPath} — falling back to []`);
}

function matchRoute(method: string, apiPath: string, rawUrl: string) {
  return getRoutes().find(route => {
    if (route.method && route.method.toUpperCase() !== method) {
      return false;
    }
    // A stateful (/g) regex would skip matches, so test a fresh copy.
    const pattern = route.url.global
      ? new RegExp(route.url.source, route.url.flags.replace('g', ''))
      : route.url;

    return pattern.test(apiPath) || pattern.test(rawUrl);
  });
}

function buildResponse(payload: any): Response {
  const wrapped = isChessResponse(payload);
  const status = wrapped ? (payload.status ?? 200) : 200;
  const body = wrapped ? payload.body : payload;
  const extraHeaders = wrapped ? payload.headers : undefined;

  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });

  // A 204 (and friends) must not carry a body.
  const hasBody = status !== 204 && status !== 205 && status !== 304;

  return new Response(hasBody ? JSON.stringify(body ?? null) : null, {
    status,
    statusText: status === 200 ? 'OK' : '',
    headers,
  });
}

type ChessFetchOptions = {
  body?: any;
  headers?: Headers;
  method?: string;
};

/**
 * Devtools helper: see which domain file answers a url, and what it returns,
 * without going through the app. In the browser console:
 *
 *   await __chessProbe('/organizations/pawn-patrol/issues/25/autofix/setup/')
 *
 * `source` is the domain file that won. Two domains can register overlapping
 * patterns, and the earlier file silently wins — this is how you catch that.
 */
(window as any).__chessProbe = async (url: string, method = 'GET') => {
  const apiPath = toApiPath(url);
  const route = matchRoute(method.toUpperCase(), apiPath, url);
  const response = await chessFetch(url, {method});

  return {
    matched: !!route,
    source: route?.source ?? null,
    pattern: route ? String(route.url) : null,
    status: response.status,
    body: await response.clone().json(),
  };
};

/**
 * Devtools helper: every route that could answer a url, in match order. If this
 * returns more than one entry, only the first is reachable.
 */
(window as any).__chessWhoOwns = (url: string, method = 'GET') => {
  const apiPath = toApiPath(url);
  const upper = method.toUpperCase();

  return getRoutes()
    .filter(route => {
      if (route.method && route.method.toUpperCase() !== upper) {
        return false;
      }
      return route.url.test(apiPath) || route.url.test(url);
    })
    .map((route, i) => `${i === 0 ? 'WINS' : 'shadowed'}  ${route.source}  ${route.url}`);
};

/**
 * Drop-in replacement for `fetch` used by `sentry/api`'s `Client`.
 * Always resolves locally — nothing here touches the network.
 */
export async function chessFetch(
  url: string,
  options: ChessFetchOptions = {}
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const apiPath = toApiPath(url);
  const route = matchRoute(method, apiPath, url);

  if (!route) {
    recordUnmatched(method, apiPath);
    return buildResponse([]);
  }

  // Handlers usually want the parsed JSON body rather than the raw string.
  let data: any;
  if (typeof options.body === 'string') {
    try {
      data = JSON.parse(options.body);
    } catch {
      data = options.body;
    }
  } else {
    data = options.body;
  }

  try {
    const payload = await route.handler(apiPath, {...options, method, data, url});
    return buildResponse(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[chessMode] handler threw for ${method} ${apiPath}`, err);
    return buildResponse(
      chessResponse({detail: 'chess mode handler error'}, {status: 500})
    );
  }
}
