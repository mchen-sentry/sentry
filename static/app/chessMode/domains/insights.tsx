/**
 * Chess-mode domain: Dashboards -> chess analytics.
 *
 * Dashboards was picked over Insights because an Insights landing page is now
 * itself a prebuilt dashboard whose widget definitions are frozen client-side
 * constants (`views/dashboards/utils/prebuiltConfigs/**`), sitting behind an
 * onboarding gate that reads project telemetry flags. Owning the dashboard
 * document lets us choose widgets whose data shapes are trivial to fake, and
 * the whole surface renders off five endpoints.
 *
 * Every widget is `widgetType: 'error-events'` on purpose: span widgets add
 * two extra "raw count" /events/ requests per chart for the confidence footer.
 */

// Matches the registry contract in `sentry/chessMode/registry`. Declared
// locally so this module has no import-time dependency on the registry.
type ChessRoute = {
  handler: (url: string, options: any) => any;
  url: RegExp;
  method?: string;
};

const DASHBOARD_ID = '1';
const DASHBOARD_TITLE = 'Pawn Patrol Overview';

function bigNumber(
  id: string,
  title: string,
  aggregate: string,
  conditions: string,
  x: number
) {
  return {
    id,
    title,
    displayType: 'big_number',
    widgetType: 'error-events',
    interval: '1h',
    layout: {x, y: 0, w: 2, h: 1, minH: 1},
    queries: [
      {
        name: '',
        aggregates: [aggregate],
        columns: [],
        fields: [aggregate],
        conditions,
        orderby: '',
      },
    ],
  };
}

function chart(
  id: string,
  title: string,
  displayType: 'line' | 'area',
  conditions: string,
  x: number
) {
  return {
    id,
    title,
    displayType,
    widgetType: 'error-events',
    interval: '1h',
    layout: {x, y: 1, w: 3, h: 2, minH: 2},
    queries: [
      {
        name: '',
        // A single aggregate keeps the events-stats response in its simple
        // single-series shape instead of the keyed multi-series one.
        aggregates: ['count()'],
        columns: [],
        fields: ['count()'],
        conditions,
        orderby: '',
      },
    ],
  };
}

function table(
  id: string,
  title: string,
  groupBy: string,
  aggregates: string[],
  aliases: string[],
  x: number
) {
  return {
    id,
    title,
    displayType: 'table',
    widgetType: 'error-events',
    interval: '1h',
    layout: {x, y: 3, w: 3, h: 3, minH: 2},
    queries: [
      {
        name: '',
        fields: [groupBy, ...aggregates],
        aggregates,
        columns: [groupBy],
        fieldAliases: aliases,
        conditions: '',
        orderby: `-${aggregates[0]}`,
      },
    ],
  };
}

const WIDGETS = [
  bigNumber('1', 'Games Played', 'count()', 'chess.event:game_finished', 0),
  bigNumber('2', 'Average Accuracy', 'avg(chess.accuracy)', '', 2),
  bigNumber('3', 'Blunders per Game', 'avg(chess.blunders)', '', 4),
  chart('4', 'Games per Hour', 'line', 'chess.event:game_finished', 0),
  chart('5', 'Blunders per Hour', 'area', 'chess.event:blunder', 3),
  table(
    '6',
    'Top Openings',
    'chess.opening',
    ['count()', 'avg(chess.accuracy)'],
    ['Opening', 'Games', 'Accuracy'],
    0
  ),
  table(
    '7',
    'Most Blundered By',
    'chess.player',
    ['count()', 'avg(chess.blunders)'],
    ['Player', 'Games', 'Blunders'],
    3
  ),
];

const DASHBOARD = {
  id: DASHBOARD_ID,
  title: DASHBOARD_TITLE,
  dateCreated: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  projects: [],
  environment: [],
  filters: {},
  permissions: {isEditableByEveryone: true},
  isFavorited: true,
  widgets: WIDGETS,
};

const DASHBOARD_LIST_ITEM = {
  id: DASHBOARD_ID,
  title: DASHBOARD_TITLE,
  widgetDisplay: WIDGETS.map(widget => widget.displayType),
  widgetPreview: WIDGETS.map(widget => ({
    displayType: widget.displayType,
    layout: widget.layout,
  })),
  projects: [],
  environment: [],
  filters: {},
  dateCreated: DASHBOARD.dateCreated,
  isFavorited: true,
  createdBy: {
    id: '1',
    name: 'Magnus Sentry',
    email: 'magnus@pawn-patrol.dev',
  },
};

// -- timeseries generation ---------------------------------------------------

const UNIT_SECONDS: Record<string, number> = {s: 1, m: 60, h: 3600, d: 86400, w: 604800};

function parseDuration(value: unknown, fallback: number) {
  const match = typeof value === 'string' ? value.match(/^(\d+)([smhdw])$/) : null;
  if (!match) {
    return fallback;
  }
  return Number(match[1]) * (UNIT_SECONDS[match[2]!] ?? 1);
}

/**
 * Deterministic pseudo-random in [0, 1) so the charts look noisy but never
 * change shape between renders (React Query will refetch on focus).
 */
function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function makeSeries(query: any, {base, swing}: {base: number; swing: number}) {
  const intervalSeconds = parseDuration(query?.interval, 3600);
  const periodSeconds = parseDuration(query?.statsPeriod, 14 * 86400);
  const points = Math.max(12, Math.min(200, Math.round(periodSeconds / intervalSeconds)));

  const end = Math.floor(Date.now() / 1000 / intervalSeconds) * intervalSeconds;
  const data: Array<[number, Array<{count: number}>]> = [];

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = end - i * intervalSeconds;
    // Chess clubs are busiest in the evening, so bend the series with a
    // daily cycle plus a little noise.
    const hour = new Date(timestamp * 1000).getUTCHours();
    const daily = Math.sin(((hour - 4) / 24) * Math.PI * 2) * 0.35 + 1;
    const count = Math.max(0, Math.round(base * daily + noise(timestamp) * swing));
    data.push([timestamp, [{count}]]);
  }

  return {
    data,
    meta: {
      fields: {'count()': 'integer'},
      units: {'count()': null},
      isMetricsData: false,
      tips: {},
      dataset: 'errors',
    },
    start: data[0]?.[0],
    end: data[data.length - 1]?.[0],
  };
}

// -- table data --------------------------------------------------------------

const OPENING_ROWS = [
  ['Sicilian Defense', 412, 88.4],
  ['Ruy Lopez', 306, 91.2],
  ['Queen’s Gambit Declined', 271, 89.7],
  ['Italian Game', 244, 86.1],
  ['French Defense', 198, 84.9],
  ['Caro-Kann Defense', 173, 90.3],
  ['King’s Indian Defense', 151, 82.6],
  ['English Opening', 122, 87.8],
  ['Evans Gambit', 64, 79.4],
  ['Barnes Opening', 9, 41.2],
] as const;

const PLAYER_ROWS = [
  ['pawn.stark', 188, 4.7],
  ['en.passant.pete', 164, 4.1],
  ['gambit.greer', 151, 3.6],
  ['castle.jenkins', 143, 2.9],
  ['knight.watch', 137, 2.4],
  ['bishop.byte', 129, 2.1],
  ['zugzwang.zoe', 118, 1.8],
  ['rook.rollins', 104, 1.5],
  ['queen.mate', 96, 1.2],
  ['magnus.sentry', 92, 0.6],
] as const;

function tableResponse(fields: string[]) {
  const has = (field: string) => fields.some(f => f.includes(field));

  if (has('chess.opening')) {
    return {
      data: OPENING_ROWS.map(([opening, games, accuracy], index) => ({
        id: String(index + 1),
        'chess.opening': opening,
        'count()': games,
        'avg(chess.accuracy)': accuracy,
      })),
      meta: {
        fields: {
          'chess.opening': 'string',
          'count()': 'integer',
          'avg(chess.accuracy)': 'number',
        },
        units: {'chess.opening': null, 'count()': null, 'avg(chess.accuracy)': null},
      },
    };
  }

  if (has('chess.player')) {
    return {
      data: PLAYER_ROWS.map(([player, games, blunders], index) => ({
        id: String(index + 1),
        'chess.player': player,
        'count()': games,
        'avg(chess.blunders)': blunders,
      })),
      meta: {
        fields: {
          'chess.player': 'string',
          'count()': 'integer',
          'avg(chess.blunders)': 'number',
        },
        units: {'chess.player': null, 'count()': null, 'avg(chess.blunders)': null},
      },
    };
  }

  // Single-aggregate request: a big_number widget.
  const values: Record<string, number> = {
    'count()': 1847,
    'avg(chess.accuracy)': 87.4,
    'avg(chess.blunders)': 2.3,
  };
  const row: Record<string, number | string> = {id: '1'};
  const meta: Record<string, string> = {};
  for (const field of fields) {
    row[field] = values[field] ?? 0;
    meta[field] = field.startsWith('count') ? 'integer' : 'number';
  }
  return {data: [row], meta: {fields: meta, units: {}}};
}

// -- routes ------------------------------------------------------------------

function isDashboardRequest(options: any) {
  const referrer = options?.query?.referrer;
  return typeof referrer === 'string' && referrer.startsWith('api.dashboards');
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return typeof value === 'string' && value ? [value] : [];
}

const routes: ChessRoute[] = [
  {
    url: /\/organizations\/[^/]+\/dashboards\/starred\/(\?.*)?$/,
    handler: () => [],
  },
  {
    url: /\/organizations\/[^/]+\/dashboards\/[^/]+\/visit\/(\?.*)?$/,
    handler: () => ({}),
  },
  {
    url: /\/organizations\/[^/]+\/dashboards\/(\?.*)?$/,
    handler: () => [DASHBOARD_LIST_ITEM],
  },
  {
    url: /\/organizations\/[^/]+\/dashboards\/[^/]+\/(\?.*)?$/,
    handler: () => DASHBOARD,
  },
  {
    // Chart data for every widget on the dashboard.
    url: /\/organizations\/[^/]+\/events-stats\/(\?.*)?$/,
    handler: (_url, options) => {
      const conditions = String(options?.query?.query ?? '');
      return conditions.includes('blunder')
        ? makeSeries(options?.query, {base: 34, swing: 22})
        : makeSeries(options?.query, {base: 96, swing: 40});
    },
  },
  {
    // Table + big_number widget data.
    url: /\/organizations\/[^/]+\/events\/(\?.*)?$/,
    handler: (_url, options) => {
      if (!isDashboardRequest(options)) {
        // Leave non-dashboard Discover traffic to whoever else claims it; an
        // empty result is a safe answer rather than chess-shaped nonsense.
        return {data: [], meta: {fields: {}, units: {}}};
      }
      return tableResponse(toList(options?.query?.field));
    },
  },
  {
    // Dashboard filter bar chrome.
    url: /\/organizations\/[^/]+\/releases\/(\?.*)?$/,
    handler: () => [],
  },
  {
    url: /\/organizations\/[^/]+\/tags\/(\?.*)?$/,
    handler: () => [],
  },
];

export default routes;
