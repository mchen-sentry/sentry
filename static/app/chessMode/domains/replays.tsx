/**
 * Chess-mode domain: Session Replay -> chess game replays.
 *
 * The replay index is a real Sentry replay table fed by fake records; the
 * detail route is taken over by an animated chessboard (see
 * `sentry/chessMode/components/chessReplayDetail`).
 *
 * The gag mapping for the index columns:
 *   user.display_name -> the player whose session it was
 *   browser           -> the opening played (version = ECO code)
 *   os                -> the time control
 *   duration          -> how long the game took
 *   count_errors      -> blunders
 *   urls              -> the room the game was played in
 */

// Matches the registry contract in `sentry/chessMode/registry`. Declared
// locally so this module has no import-time dependency on the registry.
type ChessRoute = {
  handler: (url: string, options: any) => any;
  url: RegExp;
  method?: string;
};

export type ChessGame = {
  /** ECO code, shown as the "browser version" */
  eco: string;
  id: string;
  /** Ply indices (0-based) that were blunders */
  blunders: number[];
  black: string;
  /** Seconds */
  duration: number;
  /**
   * Space separated `SAN/fromto` tokens, e.g. `e4/e2e4 e5/e7e5`. Generated
   * from the real game score and verified by a legal-move parser, so the
   * board playback is guaranteed to be a legal game.
   */
  moves: string;
  opening: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  roomCode: string;
  /** How the game ended, shown under the board */
  termination: string;
  timeControl: string;
  white: string;
  /** Minutes ago the game started */
  startedMinutesAgo: number;
};

export const CHESS_GAMES: ChessGame[] = [
  {
    id: '7b21c0f4e1a4429e9d1f3c8a6b5d2e01',
    roomCode: 'A4V2EG',
    white: 'magnus.sentry',
    black: 'duke.karl',
    opening: 'Philidor Defense',
    eco: 'C41',
    timeControl: 'Blitz',
    duration: 1128,
    result: '1-0',
    termination: 'White won by checkmate',
    startedMinutesAgo: 47,
    blunders: [17, 19],
    moves:
      'e4/e2e4 e5/e7e5 Nf3/g1f3 d6/d7d6 d4/d2d4 Bg4/c8g4 dxe5/d4e5 Bxf3/g4f3 Qxf3/d1f3 dxe5/d6e5 Bc4/f1c4 Nf6/g8f6 Qb3/f3b3 Qe7/d8e7 Nc3/b1c3 c6/c7c6 Bg5/c1g5 b5/b7b5 Nxb5/c3b5 cxb5/c6b5 Bxb5+/c4b5 Nbd7/b8d7 O-O-O/e1c1 Rd8/a8d8 Rxd7/d1d7 Rxd7/d8d7 Rd1/h1d1 Qe6/e7e6 Bxd7+/b5d7 Nxd7/f6d7 Qb8+/b3b8 Nxb8/d7b8 Rd8#/d1d8',
  },
  {
    id: 'c93e5a17d0b8471fae62d94c3f708b52',
    roomCode: 'K9NX1T',
    white: 'rook.rollins',
    black: 'zugzwang.zoe',
    opening: "King's Gambit Accepted",
    eco: 'C33',
    timeControl: 'Classical',
    duration: 4812,
    result: '1-0',
    termination: 'White won by checkmate',
    startedMinutesAgo: 194,
    blunders: [33, 35, 37],
    moves:
      'e4/e2e4 e5/e7e5 f4/f2f4 exf4/e5f4 Bc4/f1c4 Qh4+/d8h4 Kf1/e1f1 b5/b7b5 Bxb5/c4b5 Nf6/g8f6 Nf3/g1f3 Qh6/h4h6 d3/d2d3 Nh5/f6h5 Nh4/f3h4 Qg5/h6g5 Nf5/h4f5 c6/c7c6 g4/g2g4 Nf6/h5f6 Rg1/h1g1 cxb5/c6b5 h4/h2h4 Qg6/g5g6 h5/h4h5 Qg5/g6g5 Qf3/d1f3 Ng8/f6g8 Bxf4/c1f4 Qf6/g5f6 Nc3/b1c3 Bc5/f8c5 Nd5/c3d5 Qxb2/f6b2 Bd6/f4d6 Bxg1/c5g1 e5/e4e5 Qxa1+/b2a1 Ke2/f1e2 Na6/b8a6 Nxg7+/f5g7 Kd8/e8d8 Qf6+/f3f6 Nxf6/g8f6 Be7#/d6e7',
  },
  {
    id: '2f8ab6c05d3e4a7b91c4e08f6d21937a',
    roomCode: 'QG7B4M',
    white: 'gambit.greer',
    black: 'bishop.byte',
    opening: 'Evans Gambit',
    eco: 'C52',
    timeControl: 'Rapid',
    duration: 1974,
    result: '1-0',
    termination: 'White won by checkmate',
    startedMinutesAgo: 361,
    blunders: [37],
    moves:
      'e4/e2e4 e5/e7e5 Nf3/g1f3 Nc6/b8c6 Bc4/f1c4 Bc5/f8c5 b4/b2b4 Bxb4/c5b4 c3/c2c3 Ba5/b4a5 d4/d2d4 exd4/e5d4 O-O/e1g1 d3/d4d3 Qb3/d1b3 Qf6/d8f6 e5/e4e5 Qg6/f6g6 Re1/f1e1 Nge7/g8e7 Ba3/c1a3 b5/b7b5 Qxb5/b3b5 Rb8/a8b8 Qa4/b5a4 Bb6/a5b6 Nbd2/b1d2 Bb7/c8b7 Ne4/d2e4 Qf5/g6f5 Bxd3/c4d3 Qh5/f5h5 Nf6+/e4f6 gxf6/g7f6 exf6/e5f6 Rg8/h8g8 Rad1/a1d1 Qxf3/h5f3 Rxe7+/e1e7 Nxe7/c6e7 Qxd7+/a4d7 Kxd7/e8d7 Bf5+/d3f5 Ke8/d7e8 Bd7+/f5d7 Kf8/e8f8 Bxe7#/a3e7',
  },
  {
    id: 'e04d7b93a256418cbf3901d7e6c58a24',
    roomCode: 'N3PL8W',
    white: 'castle.jenkins',
    black: 'magnus.sentry',
    opening: 'Grünfeld Defense',
    eco: 'D97',
    timeControl: 'Classical',
    duration: 7266,
    result: '0-1',
    termination: 'Black won by checkmate',
    startedMinutesAgo: 1042,
    blunders: [16, 22],
    moves:
      'Nf3/g1f3 Nf6/g8f6 c4/c2c4 g6/g7g6 Nc3/b1c3 Bg7/f8g7 d4/d2d4 O-O/e8g8 Bf4/c1f4 d5/d7d5 Qb3/d1b3 dxc4/d5c4 Qxc4/b3c4 c6/c7c6 e4/e2e4 Nbd7/b8d7 Rd1/a1d1 Nb6/d7b6 Qc5/c4c5 Bg4/c8g4 Bg5/f4g5 Na4/b6a4 Qa3/c5a3 Nxc3/a4c3 bxc3/b2c3 Nxe4/f6e4 Bxe7/g5e7 Qb6/d8b6 Bc4/f1c4 Nxc3/e4c3 Bc5/e7c5 Rfe8+/f8e8 Kf1/e1f1 Be6/g4e6 Bxb6/c5b6 Bxc4+/e6c4 Kg1/f1g1 Ne2+/c3e2 Kf1/g1f1 Nxd4+/e2d4 Kg1/f1g1 Ne2+/d4e2 Kf1/g1f1 Nc3+/e2c3 Kg1/f1g1 axb6/a7b6 Qb4/a3b4 Ra4/a8a4 Qxb6/b4b6 Nxd1/c3d1 h3/h2h3 Rxa2/a4a2 Kh2/g1h2 Nxf2/d1f2 Re1/h1e1 Rxe1/e8e1 Qd8+/b6d8 Bf8/g7f8 Nxe1/f3e1 Bd5/c4d5 Nf3/e1f3 Ne4/f2e4 Qb8/d8b8 b5/b7b5 h4/h3h4 h5/h7h5 Ne5/f3e5 Kg7/g8g7 Kg1/h2g1 Bc5+/f8c5 Kf1/g1f1 Ng3+/e4g3 Ke1/f1e1 Bb4+/c5b4 Kd1/e1d1 Bb3+/d5b3 Kc1/d1c1 Ne2+/g3e2 Kb1/c1b1 Nc3+/e2c3 Kc1/b1c1 Rc2#/a2c2',
  },
  {
    id: '9a1c46e802b74f35d8e07c2a5b91f6d3',
    roomCode: 'F7RQ2C',
    white: 'queen.mate',
    black: 'pawn.stark',
    opening: "Bishop's Opening",
    eco: 'C50',
    timeControl: 'Bullet',
    duration: 63,
    result: '1-0',
    termination: "White won by checkmate (Scholar's Mate)",
    startedMinutesAgo: 12,
    blunders: [5],
    moves: 'e4/e2e4 e5/e7e5 Bc4/f1c4 Nc6/b8c6 Qh5/d1h5 Nf6/g8f6 Qxf7#/h5f7',
  },
  {
    id: '5d3f92b71c0a486e9f14b6d803e27c5a',
    roomCode: 'B2ZZ9K',
    white: 'en.passant.pete',
    black: 'knight.watch',
    opening: 'Barnes Opening',
    eco: 'A00',
    timeControl: 'Bullet',
    duration: 19,
    result: '0-1',
    termination: "Black won by checkmate (Fool's Mate)",
    startedMinutesAgo: 5,
    blunders: [0, 2],
    moves: 'f3/f2f3 e5/e7e5 g4/g2g4 Qh4#/d8h4',
  },
  {
    id: '81ce470a92d6435fb70e5c3d8a19f24b',
    roomCode: 'L5GT6D',
    white: 'bishop.byte',
    black: 'pawn.stark',
    opening: "Philidor Defense, Légal Trap",
    eco: 'C41',
    timeControl: 'Blitz',
    duration: 241,
    result: '1-0',
    termination: 'White won by checkmate',
    startedMinutesAgo: 88,
    blunders: [9],
    moves:
      'e4/e2e4 e5/e7e5 Bc4/f1c4 d6/d7d6 Nf3/g1f3 Bg4/c8g4 Nc3/b1c3 g6/g7g6 Nxe5/f3e5 Bxd1/g4d1 Bxf7+/c4f7 Ke7/e8e7 Nd5#/c3d5',
  },
  {
    id: 'a67b02f9d84e4137c95a1e6b3d0f8724',
    roomCode: 'C1KK7V',
    white: 'zugzwang.zoe',
    black: 'castle.jenkins',
    opening: 'Caro-Kann Defense',
    eco: 'B15',
    timeControl: 'Rapid',
    duration: 902,
    result: '1-0',
    termination: 'White won by checkmate',
    startedMinutesAgo: 630,
    blunders: [15],
    moves:
      'e4/e2e4 c6/c7c6 d4/d2d4 d5/d7d5 Nc3/b1c3 dxe4/d5e4 Nxe4/c3e4 Nf6/g8f6 Qd3/d1d3 e5/e7e5 dxe5/d4e5 Qa5+/d8a5 Bd2/c1d2 Qxe5/a5e5 O-O-O/e1c1 Nxe4/f6e4 Qd8+/d3d8 Kxd8/e8d8 Bg5+/d2g5 Ke8/d8e8 Rd8#/d1d8',
  },
  {
    id: '3e58d1a704f94b62ae83c05f7b6d29e1',
    roomCode: 'R8WM3P',
    white: 'knight.watch',
    black: 'magnus.sentry',
    opening: "Queen's Gambit Declined",
    eco: 'D02',
    timeControl: 'Classical',
    duration: 6390,
    result: '0-1',
    termination: 'White resigned',
    startedMinutesAgo: 2870,
    blunders: [40, 42],
    moves:
      'd4/d2d4 d5/d7d5 Nf3/g1f3 e6/e7e6 e3/e2e3 c5/c7c5 c4/c2c4 Nc6/b8c6 Nc3/b1c3 Nf6/g8f6 dxc5/d4c5 Bxc5/f8c5 a3/a2a3 a6/a7a6 b4/b2b4 Bd6/c5d6 Bb2/c1b2 O-O/e8g8 Qd2/d1d2 Qe7/d8e7 Bd3/f1d3 dxc4/d5c4 Bxc4/d3c4 b5/b7b5 Bd3/c4d3 Rd8/f8d8 Qe2/d2e2 Bb7/c8b7 O-O/e1g1 Ne5/c6e5 Nxe5/f3e5 Bxe5/d6e5 f4/f2f4 Bc7/e5c7 e4/e3e4 Rac8/a8c8 e5/e4e5 Bb6+/c7b6 Kh1/g1h1 Ng4/f6g4 Be4/d3e4 Qh4/e7h4 g3/g2g3 Rxc3/c8c3 gxh4/g3h4 Rd2/d8d2 Qxd2/e2d2 Bxe4+/b7e4 Qg2/d2g2 Rh3/c3h3',
  },
  {
    id: 'd2470b8e91a34c65f0d3a7c86e15b934',
    roomCode: 'T6HD5J',
    white: 'magnus.sentry',
    black: 'gambit.greer',
    opening: 'Philidor Defense',
    eco: 'C41',
    timeControl: 'Classical',
    duration: 5544,
    result: '1-0',
    termination: 'Black resigned',
    startedMinutesAgo: 4310,
    blunders: [41],
    moves:
      'e4/e2e4 e5/e7e5 Nf3/g1f3 d6/d7d6 d4/d2d4 exd4/e5d4 Qxd4/d1d4 Nc6/b8c6 Bb5/f1b5 Bd7/c8d7 Bxc6/b5c6 Bxc6/d7c6 Nc3/b1c3 Nf6/g8f6 O-O/e1g1 Be7/f8e7 Nd5/c3d5 Bxd5/c6d5 exd5/e4d5 O-O/e8g8 Bg5/c1g5 c6/c7c6 c4/c2c4 cxd5/c6d5 cxd5/c4d5 Re8/f8e8 Rfe1/f1e1 a5/a7a5 Re2/e1e2 Rc8/a8c8 Rae1/a1e1 Qd7/d8d7 Bxf6/g5f6 Bxf6/e7f6 Qg4/d4g4 Qb5/d7b5 Qc4/g4c4 Qd7/b5d7 Qc7/c4c7 Qb5/d7b5 a4/a2a4 Qxa4/b5a4 Re4/e2e4 Qb5/a4b5 Qxb7/c7b7',
  },
];

export function findGame(replayId: string): ChessGame | undefined {
  return CHESS_GAMES.find(game => game.id === replayId);
}

const PROJECT_ID = '2';
const MINUTE = 60 * 1000;

function toReplayRecord(game: ChessGame) {
  const startedAt = new Date(Date.now() - game.startedMinutesAgo * MINUTE);
  const finishedAt = new Date(startedAt.getTime() + game.duration * 1000);
  const moveCount = game.moves.split(' ').length;

  return {
    id: game.id,
    project_id: PROJECT_ID,
    // The gag: "browser" is the opening, "os" is the time control.
    browser: {name: game.opening, version: game.eco},
    os: {name: game.timeControl, version: game.timeControl === 'Bullet' ? '1+0' : '10+0'},
    device: {brand: null, family: null, model_id: null, name: null},
    sdk: {name: 'pawn-patrol.javascript', version: '9.4.1'},
    user: {
      display_name: game.white,
      email: `${game.white}@pawn-patrol.dev`,
      id: game.white,
      ip: null,
      username: game.white,
    },
    // "activity" is how sharp the game was; short mates score high.
    activity: Math.max(1, Math.min(10, Math.round(300 / Math.max(moveCount, 4)))),
    count_dead_clicks: game.blunders.length ? game.blunders.length - 1 : 0,
    count_errors: game.blunders.length,
    count_infos: moveCount,
    count_rage_clicks: game.result === '1/2-1/2' ? 0 : Math.min(game.blunders.length, 2),
    count_segments: 1,
    count_urls: 2,
    count_warnings: Math.max(0, moveCount - game.blunders.length - 20),
    duration: game.duration,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    error_ids: [],
    info_ids: [],
    warning_ids: [],
    trace_ids: [],
    urls: [
      `https://pawn-patrol.dev/room/${game.roomCode}`,
      `https://pawn-patrol.dev/room/${game.roomCode}/analysis`,
    ],
    releases: [`${game.opening.toLowerCase().replace(/[^a-z]+/g, '-')}@${game.eco}`],
    environment: 'ranked',
    dist: null,
    platform: 'javascript',
    replay_type: 'session',
    ota_updates: {channel: '', runtime_version: '', update_id: ''},
    has_viewed: game.startedMinutesAgo > 600,
    is_archived: false,
    tags: {
      opening: [game.opening],
      result: [game.result],
      room: [game.roomCode],
      white: [game.white],
      black: [game.black],
      time_control: [game.timeControl],
    },
  };
}

const RECORDS = CHESS_GAMES.map(toReplayRecord);

type Record_ = (typeof RECORDS)[number];

const SORTERS: Record<string, (a: Record_, b: Record_) => number> = {
  started_at: (a, b) => Date.parse(a.started_at) - Date.parse(b.started_at),
  duration: (a, b) => a.duration - b.duration,
  count_errors: (a, b) => a.count_errors - b.count_errors,
  count_dead_clicks: (a, b) => a.count_dead_clicks - b.count_dead_clicks,
  count_rage_clicks: (a, b) => a.count_rage_clicks - b.count_rage_clicks,
  activity: (a, b) => a.activity - b.activity,
  'browser.name': (a, b) => a.browser.name.localeCompare(b.browser.name),
  'os.name': (a, b) => a.os.name.localeCompare(b.os.name),
};

function sortRecords(sort: unknown) {
  const raw = typeof sort === 'string' && sort ? sort : '-started_at';
  const desc = raw.startsWith('-');
  const field = desc ? raw.slice(1) : raw;
  const sorter = SORTERS[field] ?? SORTERS.started_at!;
  const sorted = [...RECORDS].sort(sorter);
  return desc ? sorted.reverse() : sorted;
}

function replayIdFromUrl(url: string) {
  return url.match(/\/replays\/([0-9a-zA-Z-]+)\//)?.[1] ?? '';
}

const routes: ChessRoute[] = [
  {
    // Replay index table.
    url: /\/organizations\/[^/]+\/replays\/(\?.*)?$/,
    handler: (_url, options) => ({
      data: sortRecords(options?.query?.sort),
      enabled: true,
    }),
  },
  {
    // Single replay record (detail header, issue-detail replay previews).
    url: /\/organizations\/[^/]+\/replays\/[0-9a-zA-Z-]+\/(\?.*)?$/,
    handler: (url: string) => {
      const record = RECORDS.find(r => r.id === replayIdFromUrl(url)) ?? RECORDS[0];
      return {data: record};
    },
  },
  {
    // Dead/rage click selector widgets on the index page.
    url: /\/organizations\/[^/]+\/replay-selectors\/(\?.*)?$/,
    handler: () => ({data: []}),
  },
  {
    // "N replays" counts shown on issues.
    url: /\/organizations\/[^/]+\/replay-count\/(\?.*)?$/,
    handler: () => ({}),
  },
  {
    // rrweb recording segments. Nothing to serve: the detail route is taken
    // over by the chessboard, so no segments are ever played back.
    url: /\/replays\/[0-9a-zA-Z-]+\/recording-segments\/(\?.*)?$/,
    handler: () => [],
  },
  {
    url: /\/replays\/[0-9a-zA-Z-]+\/viewed-by\/(\?.*)?$/,
    handler: () => ({data: {viewed_by: []}}),
  },
  {
    url: /\/replays\/[0-9a-zA-Z-]+\/clicks\/(\?.*)?$/,
    handler: () => ({data: []}),
  },
  {
    url: /\/replays\/[0-9a-zA-Z-]+\/summarize\/(\?.*)?$/,
    handler: () => ({data: null}),
  },
  {
    url: /\/replays\/jobs\/delete\/(\?.*)?$/,
    handler: () => ({data: []}),
  },
];

export default routes;
