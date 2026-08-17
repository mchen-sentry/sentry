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

import {CHESS_PROJECT_ID} from 'sentry/chessMode/fixtures';
import type {ChessRoute} from 'sentry/chessMode/registry';

const DASHBOARD_ID = '1';
const DASHBOARD_TITLE = 'Pawn Patrol Overview';

/**
 * Extra dashboards so the manage page doesn't read as a one-row demo fixture.
 * Every id resolves to the same widget set, retitled — enough for a click
 * through from the list to land somewhere coherent.
 */
const OTHER_DASHBOARDS: Array<[string, string, string]> = [
  ['2', 'Board Health', 'rook.rollins'],
  ['3', 'Blunder Triage', 'zugzwang.zoe'],
  ['4', 'Endgame Performance', 'castle.jenkins'],
  ['5', 'Time Control SLOs', 'knight.watch'],
  ['6', 'Opening Repertoire (WIP)', 'gambit.greer'],
  ['7', '[Copy of] Board Health', 'pawn.stark'],
];

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

function lineChart(id: string, title: string, conditions: string, x: number) {
  return {
    id,
    title,
    displayType: 'line',
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

/**
 * Sentry's "Events by level" widget, in chess: count() grouped by the move
 * annotation. Grouping (rather than three separate aggregates) is what gives
 * the legend short, readable series names.
 */
function severityChart(id: string, title: string, x: number) {
  return {
    id,
    title,
    displayType: 'area',
    widgetType: 'error-events',
    interval: '1h',
    limit: 3,
    layout: {x, y: 1, w: 3, h: 2, minH: 2},
    queries: [
      {
        name: '',
        aggregates: ['count()'],
        columns: ['chess.severity'],
        fields: ['chess.severity', 'count()'],
        conditions: 'chess.event:annotated_move',
        orderby: '-count()',
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

// Titles borrow Sentry's metric vocabulary (crash-free rate, aggregate
// function names, percentiles, throughput units) rather than chess.com's.
const WIDGETS = [
  bigNumber('1', 'Blunder-Free Rate', 'blunder_free_rate()', '', 0),
  bigNumber('2', 'avg(accuracy)', 'avg(chess.accuracy)', '', 2),
  bigNumber('3', 'p75 Blunders per Game', 'p75(chess.blunders)', '', 4),
  severityChart('4', 'Blunders by Severity', 0),
  lineChart('5', 'Game Throughput (gpm)', 'chess.event:game_finished', 3),
  table(
    '6',
    'Openings by Volume',
    'chess.opening',
    ['count()', 'avg(chess.accuracy)'],
    ['Opening', 'Games', 'Accuracy'],
    0
  ),
  table(
    '7',
    'Players Ordered by Blunder Rate',
    'chess.player',
    ['count()', 'avg(chess.blunders)'],
    ['Player', 'Games', 'Blunders'],
    3
  ),
];

function dashboardFor(id: string, title: string) {
  return {
    id,
    title,
    dateCreated: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    // Match the url's `?project=`, otherwise the filter bar reports the page
    // filters as unsaved changes and shows Save/Cancel on first load.
    projects: [Number(CHESS_PROJECT_ID)],
    environment: [],
    filters: {},
    permissions: {isEditableByEveryone: true},
    isFavorited: id === DASHBOARD_ID,
    widgets: WIDGETS,
  };
}

const DASHBOARD_TITLES = new Map<string, string>([
  [DASHBOARD_ID, DASHBOARD_TITLE],
  ...OTHER_DASHBOARDS.map(([id, title]) => [id, title] as [string, string]),
]);

function listItem(id: string, title: string, owner: string, daysAgo: number) {
  return {
    id,
    title,
    widgetDisplay: WIDGETS.map(widget => widget.displayType),
    widgetPreview: WIDGETS.map(widget => ({
      displayType: widget.displayType,
      layout: widget.layout,
    })),
    projects: [Number(CHESS_PROJECT_ID)],
    environment: [],
    filters: {},
    dateCreated: new Date(Date.now() - daysAgo * 86400 * 1000).toISOString(),
    isFavorited: id === DASHBOARD_ID,
    createdBy: {
      id,
      name: owner,
      email: `${owner}@pawn-patrol.dev`,
    },
  };
}

const DASHBOARD_LIST = [
  listItem(DASHBOARD_ID, DASHBOARD_TITLE, 'magnus.sentry', 30),
  ...OTHER_DASHBOARDS.map(([id, title, owner], index) =>
    listItem(id, title, owner, 3 + index * 11)
  ),
];

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

/**
 * The keyed multi-series shape, used when a chart query groups by a column.
 * Keys become the legend labels, `order` fixes the stacking order.
 */
function makeGroupedSeries(
  query: {interval: string | null; statsPeriod: string | null},
  groups: Array<{base: number; name: string; swing: number}>
) {
  return Object.fromEntries(
    groups.map((group, index) => [
      group.name,
      {...makeSeries(query, group), order: index},
    ])
  );
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
    // A percentage field is rendered as a fraction, so 0.982 shows as 98.2%.
    'blunder_free_rate()': 0.982,
    'avg(chess.accuracy)': 87.4,
    'p75(chess.blunders)': 2.3,
    'avg(chess.blunders)': 2.3,
  };
  const row: Record<string, number | string> = {id: '1'};
  const meta: Record<string, string> = {};
  for (const field of fields) {
    row[field] = values[field] ?? 0;
    meta[field] = field.includes('rate()')
      ? 'percentage'
      : field.startsWith('count')
        ? 'integer'
        : 'number';
  }
  return {data: [row], meta: {fields: meta, units: {}}};
}

// -- query parsing -----------------------------------------------------------

// The registry hands handlers the url with its query string attached, and the
// api client serializes arrays with `qs` defaults (`field[0]=`, `field[1]=`),
// so repeated params have to be collected by prefix rather than by exact name.

function queryParams(url: string) {
  const index = url.indexOf('?');
  return new URLSearchParams(index === -1 ? '' : url.slice(index + 1));
}

function listParam(params: URLSearchParams, key: string): string[] {
  const values: string[] = [];
  params.forEach((value, name) => {
    if (name === key || name.startsWith(`${key}[`)) {
      values.push(value);
    }
  });
  return values;
}

// -- routes ------------------------------------------------------------------

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
    // Dashboard list. `?filter=onlyFavorites` and `?filter=onlyPrebuilt` come
    // through here too, hence the filtering on the query rather than the path.
    url: /\/organizations\/[^/]+\/dashboards\/(\?.*)?$/,
    handler: url => {
      const filter = queryParams(url).get('filter');
      if (filter === 'onlyFavorites') {
        return DASHBOARD_LIST.filter(item => item.isFavorited);
      }
      if (filter === 'onlyPrebuilt') {
        return [];
      }
      return DASHBOARD_LIST;
    },
  },
  {
    url: /\/organizations\/[^/]+\/dashboards\/[^/]+\/(\?.*)?$/,
    handler: url => {
      const id = url.match(/\/dashboards\/([^/?]+)\//)?.[1] ?? DASHBOARD_ID;
      return dashboardFor(id, DASHBOARD_TITLES.get(id) ?? DASHBOARD_TITLE);
    },
  },
  {
    // Chart data for every widget on the dashboard. A query that groups by a
    // column needs the keyed multi-series shape; everything else is a single
    // series told apart by the widget's `conditions`, which arrive as `query`.
    url: /\/organizations\/[^/]+\/events-stats\/(\?.*)?$/,
    handler: url => {
      const params = queryParams(url);
      const timing = {
        interval: params.get('interval'),
        statsPeriod: params.get('statsPeriod'),
      };

      if (listParam(params, 'field').some(field => field.includes('chess.severity'))) {
        return makeGroupedSeries(timing, [
          {name: 'inaccuracy', base: 62, swing: 30},
          {name: 'mistake', base: 34, swing: 18},
          {name: 'blunder', base: 15, swing: 11},
        ]);
      }

      return makeSeries(timing, {base: 96, swing: 40});
    },
  },
  {
    // Table + big_number widget data.
    url: /\/organizations\/[^/]+\/events\/(\?.*)?$/,
    handler: url => {
      const params = queryParams(url);
      if (!params.get('referrer')?.startsWith('api.dashboards')) {
        // Leave non-dashboard Discover traffic alone; an empty result is a
        // safer answer than chess-shaped nonsense in someone else's table.
        return {data: [], meta: {fields: {}, units: {}}};
      }
      return tableResponse(listParam(params, 'field'));
    },
  },
];

// eslint-disable-next-line @sentry/no-default-exports -- registry contract
export default routes;
