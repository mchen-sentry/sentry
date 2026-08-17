/**
 * Pawn Patrol — GAMES domain.
 *
 * Issues are finished chess games. Every group is a game post-mortem
 * (PAWN-MORTEM-N), severity tracks how blunder-filled the game was, and the
 * latest event carries the real chess payload:
 *
 *  - the move list rendered as a stack trace (each ply is a frame, the graded
 *    move is the crashing frame, `vars` holds the engine eval),
 *  - the same moves as breadcrumbs, levelled by move grade,
 *  - "Chess Game" / "Players" / "Engine Review" / "Clock" context cards,
 *  - tags for result, termination, opening, room, accuracy, blunders.
 *
 * Everything here is static — no network, no backend.
 */

import {
  CHESS_ORG_SLUG,
  CHESS_PROJECT_ID,
  CHESS_PROJECT_SLUG,
} from 'sentry/chessMode/fixtures';
import {type ChessRoute, chessResponse} from 'sentry/chessMode/registry';

const ORG_SLUG = CHESS_ORG_SLUG;
const PROJECT_ID = CHESS_PROJECT_ID;
const PROJECT_SLUG = CHESS_PROJECT_SLUG;

const PROJECT = {
  id: PROJECT_ID,
  slug: PROJECT_SLUG,
  name: 'Pawn Mortem',
  platform: 'other',
};

type ChessUser = {
  email: string;
  id: string;
  name: string;
  username: string;
};

const USERS: ChessUser[] = [
  {
    id: '1',
    name: 'Magnus Sentry',
    username: 'magnus',
    email: 'magnus.the.mouse@pawn-patrol.dev',
  },
  {
    id: '2',
    name: 'Hikaru Nakamonitor',
    username: 'hikaru',
    email: 'hikaru@pawn-patrol.dev',
  },
  {
    id: '3',
    name: 'Judit Polgarbage-Collector',
    username: 'judit',
    email: 'judit@pawn-patrol.dev',
  },
  {
    id: '4',
    name: 'Bobby Fisherman',
    username: 'bobby',
    email: 'bobby@pawn-patrol.dev',
  },
  {
    id: '5',
    name: 'Ding Liren-Timeout',
    username: 'ding',
    email: 'ding@pawn-patrol.dev',
  },
];

function userFixture(u: ChessUser) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    avatarUrl: null,
    isActive: true,
    hasPasswordAuth: true,
    isManaged: false,
    dateJoined: '2025-01-04T00:00:00.000Z',
    lastLogin: '2026-08-16T10:00:00.000Z',
    has2fa: false,
    lastActive: '2026-08-17T09:00:00.000Z',
    isSuperuser: false,
    isStaff: false,
    experiments: {},
    emails: [{id: u.id, email: u.email, is_verified: true}],
    avatar: {avatarType: 'letter_avatar', avatarUuid: null, avatarUrl: null},
    options: {},
    flags: {newsletter_consent_prompt: false},
    identities: [],
    ip_address: '127.0.0.1',
  };
}

// Content: 25 games.

type Grade =
  | 'book'
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'brilliant'
  | 'miss';

type GameSeed = {
  /** issue level; tracks how blunder-filled the game was */
  black: string;
  blackAcc: number;
  blackElo: number;
  eco: string;
  /** exception type shown on the stack trace header */
  errType: string;
  errValue: string;
  finalFen: string;
  /** ply index (0-based) -> grade. Ungraded plies default to "good". */
  grades: Record<number, Grade>;
  /** hours ago the game ended */
  hoursAgo: number;
  level: 'fatal' | 'error' | 'warning' | 'info';
  /** space separated SAN */
  moves: string;
  opening: string;
  priority: 'high' | 'medium' | 'low';
  result: '1-0' | '0-1' | '1/2-1/2';
  room: string;
  status: 'unresolved' | 'resolved' | 'ignored';
  termination: string;
  timeControl: string;
  title: string;
  white: string;
  whiteAcc: number;
  whiteElo: number;
  /** index into USERS, or null for unassigned */
  assignee?: number | null;
  comments?: number;
  hasSeen?: boolean;
};

const GAMES: GameSeed[] = [
  {
    title: 'ReferenceError: queen is not defended',
    level: 'fatal',
    priority: 'high',
    status: 'unresolved',
    room: 'A4V2EG',
    eco: 'C50',
    opening: 'Italian Game, Giuoco Pianissimo',
    white: 'knightrider_92',
    black: 'en_passant_enjoyer',
    whiteElo: 1742,
    blackElo: 1768,
    whiteAcc: 91.4,
    blackAcc: 62.8,
    result: '1-0',
    termination: 'resignation',
    timeControl: '3+2',
    finalFen: '5rk1/bppq2p1/p2pp3/6N1/2N1P3/2PP3P/PP3PP1/R1BQR1K1 b - - 0 13',
    moves:
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Be6 Bxe6 fxe6 Nc4 Qg5 Nxg5 hxg5 Qf3',
    grades: {6: 'book', 21: 'inaccuracy', 23: 'blunder', 24: 'best'},
    errType: 'HangingPiece',
    errValue: 'Queen left en prise on g5 (eval +0.4 → -8.7)',
    hoursAgo: 2,
    assignee: 0,
    hasSeen: false,
    comments: 3,
  },
  {
    title: 'RangeError: Maximum call stack size exceeded',
    level: 'warning',
    priority: 'low',
    status: 'unresolved',
    room: 'RP3T1D',
    eco: 'D35',
    opening: "Queen's Gambit Declined, Exchange Variation",
    white: 'solid_as_a_rook',
    black: 'drawish_dave',
    whiteElo: 2011,
    blackElo: 2004,
    whiteAcc: 94.1,
    blackAcc: 93.6,
    result: '1/2-1/2',
    termination: 'threefold repetition',
    timeControl: '15+10',
    finalFen: '1r2r1k1/p4pp1/1p5p/3p4/3P4/1PN1P3/P4PPP/1R2R1K1 b - - 12 62',
    moves:
      'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 Be2 Bb7 Bxf6 Bxf6 cxd5 exd5 O-O c6 Qb3 Bc8 Rfc1 Nd7 Na4 Bg5 Nc3 Bf6 Ne1 Re8 Nd3 Nf8 Qc2 Ne6 b3 Qd6 Rab1 Rab8 Ne2 Bd8 Nc3 Bf6 Ne2 Bd8 Nc3 Bf6 Ne2 Bd8 Nc3',
    grades: {8: 'book', 26: 'inaccuracy', 44: 'good', 46: 'good', 48: 'good'},
    errType: 'PositionRepeated',
    errValue: 'Identical position reached 3 times (moves 54, 58, 62)',
    hoursAgo: 9,
    assignee: null,
    hasSeen: true,
  },
  {
    title: 'TimeoutError: opponent stopped responding (tab backgrounded)',
    level: 'info',
    priority: 'low',
    status: 'resolved',
    room: 'SLK42Q',
    eco: 'B90',
    opening: 'Sicilian Defense, Najdorf Variation',
    white: 'tempo_tantrum',
    black: 'afk_andy',
    whiteElo: 1888,
    blackElo: 1903,
    whiteAcc: 84.2,
    blackAcc: 88.9,
    result: '1-0',
    termination: 'timeout',
    timeControl: '5+0',
    finalFen: 'r3k2r/1p1nbpp1/p2pbn1p/4p3/4PP2/1NN1B3/PPPQ2PP/2KR1B1R b kq - 0 17',
    moves:
      'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4 b5 g5 b4 Ne2 Ne8 f4 a5 f5 a4 Nbd4 exd4 Nxd4 b3',
    grades: {8: 'book', 20: 'good', 26: 'inaccuracy', 31: 'mistake'},
    errType: 'ClockFlag',
    errValue: 'Black clock hit 0:00.0 with 4 legal moves available',
    hoursAgo: 26,
    assignee: 4,
    hasSeen: true,
  },
  {
    title: "Scholar's Mate in 4 — again",
    level: 'error',
    priority: 'high',
    status: 'unresolved',
    room: 'SCH00L',
    eco: 'C23',
    opening: "Bishop's Opening, Scholar's Mate line",
    white: 'four_move_freddy',
    black: 'trusting_tina',
    whiteElo: 812,
    blackElo: 934,
    whiteAcc: 99.1,
    blackAcc: 41,
    result: '1-0',
    termination: 'checkmate',
    timeControl: '10+0',
    finalFen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
    moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#',
    grades: {4: 'inaccuracy', 5: 'blunder', 6: 'best'},
    errType: 'Checkmate',
    errValue: 'f7 defended only by the king; Qxf7# unstoppable',
    hoursAgo: 51,
    assignee: 1,
    hasSeen: false,
    comments: 7,
  },
  {
    title: 'IllegalStateException: no legal moves, not in check',
    level: 'error',
    priority: 'high',
    status: 'unresolved',
    room: 'ST4LEM',
    eco: 'E46',
    opening: 'Nimzo-Indian Defense, Rubinstein Variation',
    white: 'almost_had_it',
    black: 'cornered_king',
    whiteElo: 1455,
    blackElo: 1402,
    whiteAcc: 71.3,
    blackAcc: 66.2,
    result: '1/2-1/2',
    termination: 'stalemate',
    timeControl: '10+5',
    finalFen: '7k/5Q2/6R1/8/8/8/6PP/6K1 b - - 4 44',
    moves:
      'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nge2 c5 O-O dxc4 Bxc4 Nbd7 a3 Ba5 b4 cxb4 axb4 Bc7 Bb2 a6 Qb3 b5 Bd3 Bb7 Rfc1 Rc8 Ne4 Nxe4 Bxe4 Bxe4 Qxb5 axb5 Rxa8 Qxa8 Rxc7 Nb6 Rc5 Qa2 Rxb5 Nd5 Rxd5 exd5 Qxd5 Qxd5 Rd8 Qxd8+ Kh7 Qd7 Kh8 Qf7 Rg6',
    grades: {
      12: 'good',
      28: 'inaccuracy',
      40: 'mistake',
      48: 'inaccuracy',
      52: 'miss',
      53: 'good',
    },
    errType: 'Stalemate',
    errValue: 'Black to move, 0 legal moves, not in check (eval was +M3)',
    hoursAgo: 74,
    assignee: null,
    hasSeen: true,
  },
  {
    title: 'AssertionError: expected Rd8#, got a3',
    level: 'error',
    priority: 'high',
    status: 'unresolved',
    room: 'M1SS3D',
    eco: 'C67',
    opening: 'Ruy Lopez, Berlin Defense',
    white: 'pawn_pusher_prime',
    black: 'berlin_wall_bob',
    whiteElo: 1620,
    blackElo: 1655,
    whiteAcc: 68.4,
    blackAcc: 79.9,
    result: '0-1',
    termination: 'resignation',
    timeControl: '3+0',
    finalFen: '2r3k1/5ppp/8/8/2q5/P7/5PPP/3R2K1 w - - 0 31',
    moves:
      'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3 Ke8 h3 Be7 Rd1 Be6 Ne2 h5 Nfd4 Nxd4 Nxd4 Bd5 c4 Bxc4 b3 Bb4 a3 Ba5 Nc2 Bc3 Rb1 c5 Ne3 Be6 Nf5 Rd8 Rxd8+ Kxd8 Nxg7 Bxg7 Bb2 Bxb2 Rxb2 Qc4',
    grades: {8: 'book', 32: 'blunder', 33: 'good', 44: 'mistake', 48: 'blunder'},
    errType: 'MissedMate',
    errValue: 'Mate in 1 available (Rd8#); a3 played instead (eval +M1 → -3.2)',
    hoursAgo: 5,
    assignee: 2,
    hasSeen: false,
  },
  {
    title: 'UnhandledPromiseRejection: resigned at +7.4',
    level: 'fatal',
    priority: 'high',
    status: 'unresolved',
    room: 'GG4RLY',
    eco: 'E97',
    opening: 'King\'s Indian Defense, Mar del Plata',
    white: 'premature_pete',
    black: 'lucky_lucy',
    whiteElo: 1980,
    blackElo: 1944,
    whiteAcc: 89.7,
    blackAcc: 72.1,
    result: '0-1',
    termination: 'resignation',
    timeControl: '30+0',
    finalFen: '2r3k1/pp3pbp/3p1np1/q2Pp3/2P1P3/2N2P2/PPQ1B1PP/2KR3R w - - 6 22',
    moves:
      'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Nd3 f5 Bd2 Nf6 f3 f4 c5 g5 Rc1 Ng6 cxd6 cxd6 Nb5 Rf7 Qc2 Ne8 Nxa7 Bd7 Nb5 h5 Kh1 g4 Nf2 g3 hxg3 fxg3 Nd3 Qa5',
    grades: {8: 'book', 34: 'brilliant', 40: 'best', 44: 'best', 45: 'blunder'},
    errType: 'PrematureResignation',
    errValue: 'Resign submitted at eval +7.4 with a forced win in 6',
    hoursAgo: 38,
    assignee: 0,
    hasSeen: false,
    comments: 12,
  },
  {
    title: 'Fork: Nc7+ took the king and the rook',
    level: 'info',
    priority: 'low',
    status: 'resolved',
    room: 'F0RK1T',
    eco: 'B18',
    opening: 'Caro-Kann Defense, Classical Variation',
    white: 'knight_shift',
    black: 'rook_and_roll',
    whiteElo: 1710,
    blackElo: 1688,
    whiteAcc: 93.8,
    blackAcc: 74.5,
    result: '1-0',
    termination: 'resignation',
    timeControl: '10+0',
    finalFen: 'r3kb1r/ppNn1ppp/2p1pn2/8/3P4/5N2/PPP2PPP/R1B1KB1R b KQkq - 0 12',
    moves:
      'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6 Bd2 Ngf6 O-O-O Qc7 Ne5 Nxe5 dxe5 Nd5 Nc7',
    grades: {6: 'book', 25: 'mistake', 27: 'blunder', 28: 'brilliant'},
    errType: 'RoyalFork',
    errValue: 'Nc7+ forks Ke8 and Ra8 (eval +1.1 → +6.9)',
    hoursAgo: 96,
    assignee: 1,
    hasSeen: true,
  },
  {
    title: 'AssertionError: expected legal move, got user opinion',
    level: 'warning',
    priority: 'medium',
    status: 'unresolved',
    room: 'EPCRIM',
    eco: 'C02',
    opening: 'French Defense, Advance Variation',
    white: 'holy_hell_hank',
    black: 'google_en_passant',
    whiteElo: 1301,
    blackElo: 1289,
    whiteAcc: 76,
    blackAcc: 70.4,
    result: '0-1',
    termination: 'resignation',
    timeControl: '5+3',
    finalFen: 'r1bqkbnr/pp3ppp/2n1p3/3pP3/3p4/2P2N2/PP3PPP/RNBQKB1R w KQkq - 0 7',
    moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 dxc5 Bxc5 b4 Bxb4 cxb4 Nxb4 d5',
    grades: {8: 'book', 12: 'inaccuracy', 14: 'blunder', 16: 'mistake'},
    errType: 'IllegalMoveRejected',
    errValue: 'Client rejected legal capture dxc6 e.p.; 24s spent arguing in chat',
    hoursAgo: 15,
    assignee: null,
    hasSeen: false,
    comments: 21,
  },
  {
    title: 'SegmentationFault: back rank not mapped',
    level: 'error',
    priority: 'medium',
    status: 'unresolved',
    room: 'B4CKRK',
    eco: 'A30',
    opening: 'English Opening, Symmetrical Variation',
    white: 'luft_optional',
    black: 'rank_amateur',
    whiteElo: 1533,
    blackElo: 1571,
    whiteAcc: 63.9,
    blackAcc: 87.2,
    result: '0-1',
    termination: 'checkmate',
    timeControl: '15+10',
    finalFen: '6k1/5ppp/8/8/8/8/5PPP/r5K1 w - - 2 41',
    moves:
      'c4 c5 Nf3 Nf6 g3 b6 Bg2 Bb7 O-O e6 Nc3 Be7 d4 cxd4 Qxd4 d6 Rd1 a6 b3 Nbd7 Bb2 Qb8 Qe3 O-O Rac1 Rd8 Ne1 Bxg2 Nxg2 Qb7 f3 Rac8 Nf4 Nc5 Ncd5 exd5 cxd5 Nfd7 Nh5 Bf6 Nxf6+ Nxf6 e4 Nfxe4 fxe4 Nxe4 Qxe4 Rxc1 Rxc1 Qxd5 Qxd5 Rxd5 Rc8+ Kh7 Ra8 Rd1+ Kg2 Ra1',
    grades: {12: 'good', 34: 'mistake', 44: 'blunder', 52: 'mistake', 55: 'best'},
    errType: 'BackRankMate',
    errValue: 'Back rank undefended for 41 moves; h2-h3 never played',
    hoursAgo: 45,
    assignee: 3,
    hasSeen: true,
  },
  {
    title: 'NullPointerException: b2 undefined after Qb6',
    level: 'error',
    priority: 'medium',
    status: 'unresolved',
    room: 'L0ND0N',
    eco: 'D02',
    opening: 'London System',
    white: 'london_calling',
    black: 'qb6_always',
    whiteElo: 1188,
    blackElo: 1240,
    whiteAcc: 58.1,
    blackAcc: 81.7,
    result: '0-1',
    termination: 'resignation',
    timeControl: '3+2',
    finalFen: 'rnb1kbnr/pp2pppp/1q6/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq - 0 6',
    moves: 'd4 d5 Bf4 c5 e3 Nc6 Nf3 Qb6 Nbd2 Qxb2 Rb1 Qxa2 Rxb7 Bxb7',
    grades: {4: 'book', 8: 'blunder', 9: 'best', 12: 'blunder', 13: 'best'},
    errType: 'HangingPiece',
    errValue: 'b2 pawn and Rb1 both undefended after Qb6 (eval +0.1 → -4.8)',
    hoursAgo: 7,
    assignee: null,
    hasSeen: false,
  },
  {
    title: 'MaxRetriesExceeded: position repeated 3 times',
    level: 'warning',
    priority: 'low',
    status: 'ignored',
    room: 'L00PY7',
    eco: 'D15',
    opening: 'Slav Defense, Chameleon Variation',
    white: 'infinite_loop',
    black: 'while_true',
    whiteElo: 2140,
    blackElo: 2155,
    whiteAcc: 96.2,
    blackAcc: 95.8,
    result: '1/2-1/2',
    termination: 'threefold repetition',
    timeControl: '30+20',
    finalFen: '8/6k1/6p1/5p1p/5P1P/6P1/6K1/8 w - - 60 118',
    moves:
      'd4 d5 c4 c6 Nf3 Nf6 Nc3 a6 e3 b5 b3 Bg4 h3 Bxf3 Qxf3 e6 Bd2 Nbd7 Be2 Bd6 O-O O-O Rfc1 Qe7 Na2 e5 dxe5 Nxe5 Qg3 Nc4 bxc4 bxc4 Bc3 Ne4 Qf3 Nxc3 Nxc3 Rab8 Rab1 Rxb1 Rxb1 Rb8 Rxb8+ Bxb8 Qe4 g6 Kf1 Kg7 Ke1 f5 Qd4+ Qf6 Qxf6+ Kxf6 f4 Ke6 Kd2 Kd6 Kc3 Kc5 g3 h5 h4 Kd6 Kd4 Kc6 Ke5 Kc5 Kf6 Kd6 Kg7 Ke6 Kg8 Kd6 Kg7 Ke6 Kg8 Kd6 Kg7',
    grades: {8: 'book', 30: 'good', 52: 'inaccuracy', 70: 'good', 74: 'good'},
    errType: 'PositionRepeated',
    errValue: 'Same position, same side to move, 3rd occurrence at ply 235',
    hoursAgo: 172,
    assignee: null,
    hasSeen: true,
  },
  {
    title: 'TimeoutError: clock exceeded while holding mate in 1',
    level: 'fatal',
    priority: 'high',
    status: 'unresolved',
    room: 'FL4G1T',
    eco: 'B01',
    opening: 'Scandinavian Defense, Mieses-Kotroc Variation',
    white: 'bullet_bill',
    black: 'slow_and_steady',
    whiteElo: 2260,
    blackElo: 2288,
    whiteAcc: 82.6,
    blackAcc: 90.3,
    result: '0-1',
    termination: 'timeout',
    timeControl: '1+0',
    finalFen: '3r2k1/5ppp/8/8/8/6Q1/5PPP/6K1 w - - 0 33',
    moves:
      'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6 Qe2 Bb4 O-O-O Nbd7 Kb1 Bxc3 Bxc3 Qc7 Ne5 Nxe5 dxe5 Nd7 f4 O-O g4 Bg6 h4 h6 h5 Bh7 Rd6 Rad8 Rhd1 Nc5 R6d4 Rxd4 Rxd4 Rd8 Rxd8+ Qxd8 Qd2 Qxd2 Bxd2 Nd3 cxd3 Bxd3+ Ka1 Bxc4 Kb1 Rd8 Bc3 Rd1+ Kc2 Rg1 Qg3',
    grades: {8: 'book', 36: 'inaccuracy', 48: 'mistake', 56: 'best', 58: 'blunder'},
    errType: 'ClockFlag',
    errValue: 'White flagged at 0:00.0 holding mate in 1 (Rd8#)',
    hoursAgo: 3,
    assignee: 4,
    hasSeen: false,
    comments: 5,
  },
  {
    title: 'SecurityError: king relocated to hostile origin',
    level: 'fatal',
    priority: 'high',
    status: 'unresolved',
    room: 'C4STL3',
    eco: 'C27',
    opening: 'Vienna Game, Frankenstein-Dracula Variation',
    white: 'dracula_gambit',
    black: 'safe_king_myth',
    whiteElo: 1615,
    blackElo: 1590,
    whiteAcc: 88,
    blackAcc: 55.4,
    result: '1-0',
    termination: 'checkmate',
    timeControl: '5+0',
    finalFen: 'r1bq1rk1/ppp2ppp/2n5/3N4/2B1n3/5Q2/PPPP1PPP/R1B1K2R b KQ - 3 10',
    moves:
      'e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Nc6 Nb5 g6 Qf3 f5 Qd5 Qe7 Nxc7+ Kd8 Nxa8 b6 Qf7 Qxf7 Bxf7 O-O',
    grades: {6: 'inaccuracy', 12: 'mistake', 21: 'blunder', 23: 'blunder'},
    errType: 'MatingNet',
    errValue: 'O-O walks into Qf3-f7#; king safer on d8 (eval -2.1 → -M2)',
    hoursAgo: 11,
    assignee: 2,
    hasSeen: false,
  },
  {
    title: 'Insufficient material: K+N vs K after 89 moves',
    level: 'info',
    priority: 'low',
    status: 'resolved',
    room: 'K1NGKN',
    eco: 'C42',
    opening: 'Petrov Defense, Classical Attack',
    white: 'endgame_enjoyer',
    black: 'material_girl',
    whiteElo: 1820,
    blackElo: 1834,
    whiteAcc: 91,
    blackAcc: 90.2,
    result: '1/2-1/2',
    termination: 'insufficient material',
    timeControl: '15+10',
    finalFen: '8/8/4k3/8/3N4/8/8/5K2 b - - 0 89',
    moves:
      'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4 Be2 O-O Nc3 Bf5 a3 Nxc3 bxc3 Nc6 Re1 Re8 cxd5 Qxd5 Bf4 Rac8 h3 Be4 Bd3 Bxd3 Qxd3 Bf6 Rad1 Qa2 Be3 Na5 Ne5 Bxe5 dxe5 Rcd8 Qc4 Qxc4 Rd8 Rxd8 Rxd8+ Kh7 c4 Nc6 f4 Nxe5 fxe5 Rxe5 Bd4 Re4 Rd7 Rxc4 Rxb7 Rc1+ Kh2 Rc2 Rxa7 Rxg2+ Kh1 Rd2 Bc3 Rd3 Bb4 f5 a4 g5 a5 f4 a6 Rd1+ Kg2 Rd2+ Kf3 Rd3+ Ke4 Rxh3 a7 Ra3 Rb7 Rxa7 Rxa7 g4 Ra1 f3 Rf1 Kg6 Rxf3 gxf3 Kxf3 h5 Bd6 h4 Be5 Kf5 Bd4 h3 Kg3 Ke4 Kxh3 Kxd4 Nd4 Ke5 Nf3+ Ke6 Nd4+ Kd6 Kg4 Ke6 Kf4 Kd6 Ke4 Ke6 Kf4 Kd6 Kf5 Ke7 Ke5 Kd7 Kd5 Ke7 Ke5 Kd7 Kf6 Kd6',
    grades: {8: 'book', 40: 'good', 90: 'inaccuracy', 140: 'good'},
    errType: 'DeadPosition',
    errValue: 'K+N vs K — no forced mate exists, draw declared',
    hoursAgo: 120,
    assignee: null,
    hasSeen: true,
  },
  {
    title: 'ArithmeticError: compensation evaluated to NaN',
    level: 'error',
    priority: 'medium',
    status: 'unresolved',
    room: 'S4CR1F',
    eco: 'C52',
    opening: 'Evans Gambit, Compromised Defense',
    white: 'romantic_era_ryan',
    black: 'greedy_gus',
    whiteElo: 1490,
    blackElo: 1522,
    whiteAcc: 47.8,
    blackAcc: 86.4,
    result: '0-1',
    termination: 'resignation',
    timeControl: '10+0',
    finalFen: 'r1b1k1nr/pppp1ppp/8/2b1p3/2B1n3/2P5/P1P2qPP/RNBQ1K1R w kq - 0 10',
    moves:
      'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O dxc3 Qb3 Qf6 e5 Qg6 Nxc3 Nge7 Ba3 O-O Rad1 Bxc3 Qxc3 Nxe5 Nxe5 Qxe5 Qxe5 d5 Qxe7 dxc4 Rd8 Rxd8 Qxd8+ Ne8 Bxf8 Kxf8 Qd4 Nf6 Rd1 h6 h3 Kg8 Qc5 Qe4 Qxc4 Qxc4 Rd8+ Kh7 Rd4 Qxd4 Nf3 Qf2+',
    grades: {6: 'book', 13: 'mistake', 24: 'blunder', 48: 'blunder', 51: 'best'},
    errType: 'UnsoundSacrifice',
    errValue: 'Qxe5 sac gives no compensation (eval +0.6 → -5.3)',
    hoursAgo: 33,
    assignee: 0,
    hasSeen: true,
    comments: 2,
  },
  {
    title: 'ECONNRESET: opponent connection reset by peer',
    level: 'info',
    priority: 'low',
    status: 'resolved',
    room: 'D1SC0N',
    eco: 'A00',
    opening: 'Van Geet Opening (Dunst)',
    white: 'patient_pat',
    black: 'wifi_woes',
    whiteElo: 1355,
    blackElo: 1361,
    whiteAcc: 100,
    blackAcc: 100,
    result: '1-0',
    termination: 'abandonment',
    timeControl: '3+0',
    finalFen: 'rnbqkbnr/pppp1ppp/8/4p3/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 3',
    moves: 'Nc3 e5 e4 Nf6 Nf3',
    grades: {0: 'book', 1: 'book', 2: 'book', 3: 'book', 4: 'book'},
    errType: 'ConnectionLost',
    errValue: 'No heartbeat from black for 90s; game awarded to white',
    hoursAgo: 64,
    assignee: null,
    hasSeen: true,
  },
  {
    title: 'MemoryLeak: advantage freed during simplification',
    level: 'warning',
    priority: 'medium',
    status: 'unresolved',
    room: 'TR4D3S',
    eco: 'A35',
    opening: 'English Opening, Symmetrical Four Knights',
    white: 'simplify_sam',
    black: 'outside_passer',
    whiteElo: 1705,
    blackElo: 1749,
    whiteAcc: 74.9,
    blackAcc: 89.1,
    result: '0-1',
    termination: 'resignation',
    timeControl: '15+10',
    finalFen: '8/5ppp/8/p7/P7/8/5PPP/8 w - - 0 45',
    moves:
      'c4 c5 Nc3 Nc6 Nf3 Nf6 d4 cxd4 Nxd4 e6 g3 Qb6 Nb3 Ne5 e4 Bb4 Qe2 O-O Bg2 d6 O-O a5 a4 Bd7 Be3 Qc7 f4 Nc6 Rac1 Rfc8 Rfd1 Be8 Nd5 exd5 cxd5 Qxc1 Rxc1 Rxc1+ Bxc1 Nb8 Bd2 Bxd2 Nxd2 Nbd7 Nc4 Bd7 Qd3 Rc8 b3 Nc5 Qc3 b6 Bf1 Nfd7 Nd2 Rxc3 Bxb5 Nxb3 Nxb3 Rxb3 Bxd7 Nxd7 Kf2 Rb2+ Kf3 Rxh2 g4 Rh3+ Kg2 Rd3 e5 dxe5 fxe5 Nxe5 d6 Rxd6 Kg3 Rd3+ Kh4 Rd4 Kg5 Nxg4 Kxg4 Rxg4+ Kxg4',
    grades: {8: 'book', 32: 'mistake', 52: 'blunder', 60: 'mistake', 78: 'good'},
    errType: 'LostEndgame',
    errValue: 'Outside passed pawn on the a-file decides (eval -0.3 → -4.1)',
    hoursAgo: 58,
    assignee: 3,
    hasSeen: true,
  },
  {
    title: 'Bongcloud opening (1. e4 e5 2. Ke2) — and it worked',
    level: 'info',
    priority: 'low',
    status: 'resolved',
    room: 'B0NGCL',
    eco: 'C20',
    opening: 'Bongcloud Attack',
    white: 'ke2_believer',
    black: 'tilted_titan',
    whiteElo: 2405,
    blackElo: 2380,
    whiteAcc: 78.3,
    blackAcc: 61.9,
    result: '1-0',
    termination: 'resignation',
    timeControl: '1+0',
    finalFen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPPKPPP/RNBQ1B1R b kq - 4 4',
    moves:
      'e4 e5 Ke2 Nf6 Nf3 Nc6 Ke1 d5 exd5 Nxd5 Nc3 Nxc3 dxc3 Qxd1+ Kxd1 Bg4 Be3 O-O-O+ Ke1 f6 h3 Bh5 g4 Bf7 Bc4 Bxc4 Nd2 Bd5 Ne4 Be7 Rd1 Rhe8 c4 Bxe4 Rxd8+ Rxd8 Kf1 Bd3+ Kg2 Bxc4 b3 Bd5+ f3 f5 gxf5 Rf8 Rf1 Nb4 Bd2 Nd3 Bc3 e4 f4 e3 Kg3 Rxf5 Rd1 Nf2 Rd2 e2 Kg2 Ne4 Re2',
    grades: {2: 'inaccuracy', 6: 'inaccuracy', 30: 'best', 44: 'mistake', 62: 'best'},
    errType: 'KingWalk',
    errValue: 'Ke2 on move 2 (eval +0.3 → -0.4). Held anyway.',
    hoursAgo: 143,
    assignee: 1,
    hasSeen: true,
    comments: 34,
  },
  {
    title: 'Touch-move dispute escalated to the arbiter',
    level: 'error',
    priority: 'medium',
    status: 'unresolved',
    room: 'ARB1TR',
    eco: 'D85',
    opening: 'Grünfeld Defense, Exchange Variation',
    white: 'i_was_adjusting',
    black: 'jadoube_jerry',
    whiteElo: 2090,
    blackElo: 2115,
    whiteAcc: 85.5,
    blackAcc: 83,
    result: '0-1',
    termination: 'forfeit',
    timeControl: '90+30',
    finalFen: 'r1bq1rk1/pp2ppbp/2n3p1/8/2BP4/2N1BP2/PP4PP/R2QK2R w KQ - 2 12',
    moves:
      'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Be3 c5 Rc1 O-O Nf3 Nc6 d5 Ne5 Nxe5 Bxe5 Qd2 e6 f4 Bg7 Bc4 exd5 exd5 Re8',
    grades: {8: 'book', 18: 'inaccuracy', 24: 'mistake', 28: 'blunder'},
    errType: 'RuleViolation',
    errValue: 'Piece touched (Nc6) then a different piece moved; arbiter ruled forfeit',
    hoursAgo: 81,
    assignee: 2,
    hasSeen: false,
    comments: 18,
  },
  {
    title: 'Promoted to a knight for no reason, still won',
    level: 'info',
    priority: 'low',
    status: 'resolved',
    room: 'UNDRPR',
    eco: 'B04',
    opening: 'Alekhine Defense, Modern Variation',
    white: 'underpromoter',
    black: 'why_though',
    whiteElo: 1660,
    blackElo: 1602,
    whiteAcc: 87.4,
    blackAcc: 70.8,
    result: '1-0',
    termination: 'resignation',
    timeControl: '10+0',
    finalFen: '5N2/5ppp/8/8/8/6k1/5PPP/6K1 b - - 0 48',
    moves:
      'e4 Nf6 e5 Nd5 d4 d6 Nf3 g6 Bc4 Nb6 Bb3 Bg7 Ng5 e6 Qf3 Qe7 Ne4 dxe5 Bg5 Qb4+ c3 Qa5 dxe5 h6 Bd2 Qb5 O-O Nc6 Nbd2 Nd4 Qg3 N4d5 Rfe1 Bd7 a4 Qc5 Bxd5 Nxd5 Nc4 O-O-O Ne3 Nxe3 Bxe3 Qc6 Rad1 Bc8 Rxd8+ Rxd8 Nd6+ Kb8 Nxf7 Rd7 Ng5 hxg5 Bxg5 Bf8 Qf4 Rd5 e6 Bd6 Qf8 Rd1 Rxd1 Qxe6 e8=N',
    grades: {6: 'book', 30: 'good', 48: 'mistake', 60: 'best', 62: 'brilliant'},
    errType: 'Underpromotion',
    errValue: 'e8=N chosen over e8=Q with mate available either way',
    hoursAgo: 110,
    assignee: null,
    hasSeen: true,
  },
  {
    title: 'DeadlineExceeded: 100 half-moves without progress',
    level: 'warning',
    priority: 'medium',
    status: 'unresolved',
    room: 'BN_M4T',
    eco: 'A45',
    opening: 'Trompowsky Attack',
    white: 'corner_of_shame',
    black: 'just_shuffle',
    whiteElo: 1770,
    blackElo: 1712,
    whiteAcc: 80.1,
    blackAcc: 88.6,
    result: '1/2-1/2',
    termination: '50-move rule',
    timeControl: '30+0',
    finalFen: '8/8/8/8/2B5/3N4/8/k5K1 w - - 100 96',
    moves:
      'd4 Nf6 Bg5 e6 e4 h6 Bxf6 Qxf6 Nf3 d6 Nc3 Nd7 Qd2 g5 O-O-O Bg7 h4 g4 Ne1 Qe7 f3 gxf3 Nxf3 a6 e5 d5 Ne2 c5 c3 c4 Nf4 b5 Kb1 Nb6 g4 Bd7 Rg1 O-O-O Bh3 Kb8 Ng6 Qc7 Nxh8 Rxh8 g5 hxg5 hxg5 Bf8 Rh1 Rxh3 Rxh3 Bb4 cxb4 Qxc3 Qxc3 Nc8 Qc2 Nd6 exd6 Bc6 Rh8+ Ka7 Qxc4 dxc4 Rh7 Kb6 Rxf7 a5 bxa5+ Kxa5 Rf6 Kb4 Rxe6 Bd5 Re5 Kc3 Ne1 b4 Nd3 Kb3 Rxd5 c3 Rc5 Ka2 Rxc3 bxc3 d7 Ka1 d8=B Ka2 Bc7 Ka1 Bf4 Ka2 Bc1 Ka1 Bg5 Ka2 Bd8 Ka1 Bc7 Ka2 Bf4 Ka1 Bd6 Ka2 Bc5 Ka1 Bd4 Ka2 Bg1 Ka1 Bc5 Ka2 Bd6 Ka1 Be5 Ka2 Bf6 Ka1 Bc3 Ka2 Bd4 Ka1 Be3 Ka2 Bc1 Ka1 Bg5 Ka2 Bf4 Ka1 Bd2 Ka2 Bc3 Ka1 Bb4 Ka2 Bc5 Ka1 Bd6 Ka2 Be5 Ka1 Bf4 Ka2 Bc4',
    grades: {8: 'book', 60: 'inaccuracy', 96: 'mistake', 120: 'miss', 140: 'miss'},
    errType: 'FiftyMoveRule',
    errValue: '100 half-moves without a capture or pawn move; mate not found in time',
    hoursAgo: 160,
    assignee: 4,
    hasSeen: true,
  },
  {
    title: 'Perpetual check saved a dead-lost position',
    level: 'info',
    priority: 'low',
    status: 'resolved',
    room: 'P3RP3T',
    eco: 'A67',
    opening: 'Benoni Defense, Taimanov Attack',
    white: 'houdini_jr',
    black: 'winning_was_easy',
    whiteElo: 1930,
    blackElo: 1975,
    whiteAcc: 83.8,
    blackAcc: 76.5,
    result: '1/2-1/2',
    termination: 'threefold repetition',
    timeControl: '5+3',
    finalFen: '6k1/5ppp/8/8/8/6Q1/5PPP/2q3K1 w - - 8 41',
    moves:
      'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 f4 Bg7 Bb5+ Nfd7 a4 O-O Nf3 Na6 O-O Nc7 Bd3 b6 Kh1 Ba6 Bxa6 Nxa6 Qe2 Nb4 e5 dxe5 fxe5 Bxe5 Nxe5 Nxd5 Nxd5 Qxd5 Bf4 Rae8 Qc4 Qxc4 Nxc4 Rxe5 Bxe5 Nxe5 Nxb6 axb6 Rae1 Nd3 Re7 Nxb2 Rxf7 Rxf7 Rxf7 Kxf7 h3 c4 Kh2 c3 Kg3 c2 Kf4 c1=Q+ Kf5 Qc5+ Kf4 Qd4+ Kf3 Qd3+ Kf4 Qd4+ Kf3 Qd3+ Kf4 Qd4+',
    grades: {8: 'book', 32: 'mistake', 44: 'blunder', 68: 'best', 74: 'best'},
    errType: 'PerpetualCheck',
    errValue: 'Black cannot escape checks on d3/d4 (eval -6.8 → 0.00)',
    hoursAgo: 88,
    assignee: 0,
    hasSeen: true,
  },
  {
    title: 'Smothered mate: Nf7# with everything defended',
    level: 'info',
    priority: 'low',
    status: 'resolved',
    room: 'SM0TH3',
    eco: 'C41',
    opening: 'Philidor Defense, Lion Variation',
    white: 'philidor_fan',
    black: 'boxed_in_bruno',
    whiteElo: 1580,
    blackElo: 1544,
    whiteAcc: 95.7,
    blackAcc: 64.1,
    result: '1-0',
    termination: 'checkmate',
    timeControl: '10+0',
    finalFen: 'r1bqkb1r/pppp1Npp/2n5/8/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 6',
    moves: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 h6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#',
    grades: {4: 'inaccuracy', 5: 'mistake', 9: 'blunder', 10: 'brilliant', 12: 'best'},
    errType: 'SmotheredMate',
    errValue: 'King boxed by its own pieces; Nd5# with 0 escape squares',
    hoursAgo: 20,
    assignee: 1,
    hasSeen: true,
    comments: 4,
  },
  {
    title: 'TypeError: Cannot read properties of undefined (reading \'h8\')',
    level: 'fatal',
    priority: 'high',
    status: 'unresolved',
    room: 'M0US3X',
    eco: 'A88',
    opening: 'Dutch Defense, Leningrad Variation',
    white: 'butterfingers',
    black: 'free_rook_freda',
    whiteElo: 1845,
    blackElo: 1811,
    whiteAcc: 79.2,
    blackAcc: 85,
    result: '0-1',
    termination: 'resignation',
    timeControl: '3+0',
    finalFen: 'r6r/pppq1kR1/2np1n2/4p3/4P3/2N2N2/PPPQ1PPP/R5K1 w - - 0 18',
    moves:
      'd4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6 Nc3 c6 d5 e5 dxe6 Bxe6 Qb3 Qc8 Ng5 Bf7 e4 h6 exf5 hxg5 fxg6 Bxg6 Bxg5 Nbd7 Rae1 Kf7 Qc2 Qd8 Bh3 Nc5 Rxe5 dxe5 Bxg5 Rh8 Rh7',
    grades: {8: 'book', 24: 'good', 30: 'inaccuracy', 36: 'mistake', 38: 'blunder'},
    errType: 'MouseSlip',
    errValue: 'Drop released on h7 instead of h8 (eval +2.9 → -4.6)',
    hoursAgo: 1,
    assignee: null,
    hasSeen: false,
    comments: 1,
  },
];

// Derivation

const NOW = Date.now();

function iso(msAgo: number) {
  return new Date(NOW - msAgo).toISOString();
}

/** Deterministic pseudo-random so sparklines are stable across reloads. */
function makeRng(seed: number) {
  let s = seed * 2654435761 + 1;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function hex(seed: number, length: number) {
  const rand = makeRng(seed);
  let out = '';
  while (out.length < length) {
    out += Math.floor(rand() * 16).toString(16);
  }
  return out.slice(0, length);
}

const GRADE_SYMBOL: Record<Grade, string> = {
  brilliant: '!!',
  best: '!',
  good: '',
  book: '',
  inaccuracy: '?!',
  mistake: '?',
  miss: '?',
  blunder: '??',
};

const GRADE_LEVEL: Record<Grade, string> = {
  brilliant: 'info',
  best: 'info',
  good: 'info',
  book: 'debug',
  inaccuracy: 'warning',
  mistake: 'error',
  miss: 'error',
  blunder: 'fatal',
};

const LEVEL_RANK: Record<string, number> = {fatal: 4, error: 3, warning: 2, info: 1};
const PRIORITY_RANK: Record<string, number> = {high: 3, medium: 2, low: 1};

function moveLabel(index: number, san: string) {
  const moveNo = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? `${moveNo}. ${san}` : `${moveNo}... ${san}`;
}

function phaseFor(index: number, total: number) {
  if (index < 12) {
    return 'opening';
  }
  return index > total * 0.7 ? 'endgame' : 'middlegame';
}

type Ply = {
  clock: string;
  color: string;
  evalAfter: string;
  evalBand: string;
  grade: Grade;
  index: number;
  label: string;
  phase: string;
  piece: string;
  san: string;
  timePressure: string;
};

const PIECE_NAMES: Record<string, string> = {
  K: 'king',
  Q: 'queen',
  R: 'rook',
  B: 'bishop',
  N: 'knight',
};

function pieceMoved(san: string) {
  if (san.startsWith('O-O')) {
    return 'king';
  }
  return PIECE_NAMES[san[0]!] ?? 'pawn';
}

function evalBand(score: number) {
  if (Math.abs(score) < 0.5) {
    return 'equal';
  }
  if (Math.abs(score) < 3) {
    return score > 0 ? 'white better' : 'black better';
  }
  return score > 0 ? 'white winning' : 'black winning';
}

type Game = ReturnType<typeof buildGame>;

function buildGame(seed: GameSeed, i: number) {
  const sans = seed.moves.trim().split(/\s+/);
  const rand = makeRng(i + 7);
  const gameId = `${hex(i + 101, 8)}-${hex(i + 202, 4)}-${hex(i + 303, 12)}`;

  let evalScore = 0.2;
  const plies: Ply[] = sans.map((san, index) => {
    const grade = seed.grades[index] ?? 'good';
    const swing =
      grade === 'blunder'
        ? -4.5
        : grade === 'mistake' || grade === 'miss'
          ? -1.8
          : grade === 'inaccuracy'
            ? -0.6
            : grade === 'brilliant'
              ? 2.2
              : (rand() - 0.5) * 0.4;
    // evals are from white's point of view, so a black error swings positive
    evalScore += index % 2 === 0 ? swing : -swing;
    evalScore = Math.max(-12, Math.min(12, evalScore));
    const totalSeconds = parseInt(seed.timeControl.split('+')[0]!, 10) * 60;
    const remaining = Math.max(0, totalSeconds - index * 6 - Math.floor(rand() * 10));
    return {
      index,
      san,
      grade,
      label: moveLabel(index, san),
      evalAfter: `${evalScore >= 0 ? '+' : ''}${evalScore.toFixed(2)}`,
      clock: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`,
      // Facets that vary move to move, so the tag distribution card has
      // something to stagger instead of five 100% bars.
      color: index % 2 === 0 ? 'white' : 'black',
      phase: phaseFor(index, sans.length),
      piece: pieceMoved(san),
      evalBand: evalBand(evalScore),
      timePressure: remaining < 30 ? 'true' : 'false',
    };
  });

  const counts = plies.reduce<Record<string, number>>((acc, p) => {
    acc[p.grade] = (acc[p.grade] ?? 0) + 1;
    return acc;
  }, {});

  const lastSeenMs = NOW - seed.hoursAgo * 3600 * 1000;
  // a game "starts" when the first move is played
  const durationMs = Math.max(120, plies.length * 14) * 1000;
  const firstSeenMs = lastSeenMs - durationMs;
  const lastSeen = new Date(lastSeenMs).toISOString();
  const firstSeen = new Date(firstSeenMs).toISOString();

  // Events are plies and users are the spectators among them, so users can
  // never exceed events — the fastest way to spot fabricated Sentry data.
  const drama = 0.15 + rand() * 0.45 + (LEVEL_RANK[seed.level]! - 1) * 0.05;
  const spectators = Math.max(1, Math.round(plies.length * Math.min(drama, 0.75)));

  // The critical move is what a Sentry culprit points at.
  const criticalPly =
    plies.find(p => p.grade === 'blunder') ??
    plies.find(p => p.grade === 'mistake' || p.grade === 'miss') ??
    plies[plies.length - 1]!;
  const culprit = culpritFor(seed, criticalPly);

  // "Unhandled" earns its meaning: a blunder you never noticed. If the same
  // side found a best/brilliant move within the next two of its own moves,
  // you saw it and fought back, so the issue is handled.
  const blunderPly = plies.find(p => p.grade === 'blunder');
  const isUnhandled =
    !!blunderPly &&
    !plies.some(
      p =>
        p.index > blunderPly.index &&
        p.index <= blunderPly.index + 4 &&
        p.color === blunderPly.color &&
        (p.grade === 'best' || p.grade === 'brilliant')
    );

  const loser =
    seed.result === '1-0' ? seed.black : seed.result === '0-1' ? seed.white : seed.black;

  const assignee =
    seed.assignee === null || seed.assignee === undefined ? null : USERS[seed.assignee]!;

  const id = String(i + 1);

  const tags: Record<string, string> = {
    result: seed.result,
    termination: seed.termination,
    opening: seed.opening,
    eco: seed.eco,
    room: seed.room,
    time_control: seed.timeControl,
    white: seed.white,
    black: seed.black,
    blunders: String(counts.blunder ?? 0),
    mistakes: String(counts.mistake ?? 0),
    accuracy: accuracyBucket(Math.min(seed.whiteAcc, seed.blackAcc)),
    plies: String(plies.length),
    level: seed.level,
    engine: 'stockfish@17.1',
    annotation: GRADE_SYMBOL[criticalPly.grade] || 'book',
    // These five come from the critical move; the group tag endpoint reports
    // the full per-ply distribution for them.
    phase: criticalPly.phase,
    piece: criticalPly.piece,
    eval_band: criticalPly.evalBand,
    time_pressure: criticalPly.timePressure,
    color: criticalPly.color,
  };

  return {
    seed,
    id,
    shortId: `PAWN-MORTEM-${i + 1}`,
    gameId,
    eventId: hex(i + 404, 32),
    plies,
    counts,
    tags,
    loser,
    assignee,
    culprit,
    criticalPly,
    spectators,
    isUnhandled,
    firstSeen,
    lastSeen,
    firstSeenMs,
    lastSeenMs,
    stats: buildStats(i, plies.length, firstSeenMs, lastSeenMs),
  };
}

/**
 * Sentry renders a title as `type: value`, so when a game's title already reads
 * that way the stack-trace header should use the same class rather than a
 * second, different one.
 */
function exceptionType(seed: GameSeed) {
  return /^([A-Za-z_]\w*):\s/.exec(seed.title)?.[1] ?? seed.errType;
}

/** Sentry culprits read `path in function`; so do these. */
function culpritFor(seed: GameSeed, ply: Ply) {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const moveNo = Math.floor(ply.index / 2) + 1;
  const path =
    ply.phase === 'opening'
      ? `openings/${slug(seed.opening.split(',')[0]!)}.ts`
      : `${ply.phase}/${ply.piece}.ts`;
  return `${path} in move${moveNo}`;
}

function accuracyBucket(acc: number) {
  if (acc >= 90) {
    return 'excellent';
  }
  if (acc >= 80) {
    return 'good';
  }
  if (acc >= 70) {
    return 'okay';
  }
  return 'poor';
}

/**
 * A finished game is a burst, not a stream: the moves land inside the window
 * the game was played in and there is dead air on either side. Sparkline shape
 * is the first thing a Sentry user reads, so a flat noisy line would give the
 * fixture away immediately.
 */
function buildStats(i: number, plies: number, firstSeenMs: number, lastSeenMs: number) {
  const rand = makeRng(i + 31);
  const nowSec = Math.floor(NOW / 1000);
  const startSec = Math.floor(firstSeenMs / 1000);
  const endSec = Math.floor(lastSeenMs / 1000);

  const series = (buckets: number, stepSec: number) => {
    const out: Array<[number, number]> = [];
    const live: number[] = [];
    for (let b = buckets - 1; b >= 0; b--) {
      const ts = nowSec - b * stepSec;
      if (ts + stepSec > startSec && ts <= endSec) {
        live.push(out.length);
      }
      out.push([ts, 0]);
    }
    // The whole game happened inside one bucket at this resolution.
    if (!live.length && endSec > nowSec - buckets * stepSec) {
      live.push(out.length - 1 - Math.floor((nowSec - endSec) / stepSec));
    }
    distribute(plies, live.length).forEach((count, n) => {
      const slot = live[n];
      const bucket = slot === undefined ? undefined : out[slot];
      if (bucket) {
        bucket[1] = count + Math.floor(rand() * 2);
      }
    });
    return out;
  };

  return {
    '24h': series(24, 3600),
    '14d': series(14, 86400),
    '30d': series(30, 86400),
  };
}

/** Split `total` across `slots` so the parts sum to exactly `total`. */
function distribute(total: number, slots: number): number[] {
  if (slots <= 0) {
    return [];
  }
  const base = Math.floor(total / slots);
  const out = Array.from({length: slots}, () => base);
  let remainder = total - base * slots;
  for (let n = 0; remainder > 0; n = (n + 1) % slots, remainder--) {
    out[n] = (out[n] ?? 0) + 1;
  }
  return out;
}

const ALL_GAMES = GAMES.map(buildGame);
const BY_ID = new Map(ALL_GAMES.map(g => [g.id, g]));
const BY_SHORT_ID = new Map(ALL_GAMES.map(g => [g.shortId.toLowerCase(), g]));

/**
 * The most recent game for each mistake that shows up more than once. Those are
 * the only issues allowed to say "Regressed" — a finished game cannot escalate,
 * but making the same mistake again is exactly what a regression is.
 */
const REGRESSED_IDS = new Set(
  Object.values(
    ALL_GAMES.reduce<Record<string, Game[]>>((acc, g) => {
      (acc[g.seed.errType] ??= []).push(g);
      return acc;
    }, {})
  )
    .filter(group => group.length > 1)
    .map(group => group.reduce((a, b) => (a.lastSeenMs > b.lastSeenMs ? a : b)).id)
);

function substatusFor(game: Game) {
  switch (game.seed.status) {
    case 'resolved':
      return null;
    case 'ignored':
      return 'archived_until_escalating';
    default:
      break;
  }
  if (REGRESSED_IDS.has(game.id)) {
    return 'regressed';
  }
  return game.seed.hoursAgo < 12 ? 'new' : 'ongoing';
}

// Group + event builders

function buildGroup(game: Game): any {
  const {seed} = game;
  const substatus = substatusFor(game);
  return {
    id: game.id,
    shareId: null,
    shortId: game.shortId,
    title: seed.title,
    culprit: game.culprit,
    permalink: `/organizations/${ORG_SLUG}/issues/${game.id}/`,
    logger: 'pawn-patrol.engine',
    level: seed.level,
    status: seed.status,
    substatus,
    statusDetails: {},
    isPublic: false,
    platform: 'other',
    project: PROJECT,
    type: 'error',
    issueCategory: 'error',
    issueType: 'error',
    priority: seed.priority,
    priorityLockedAt: null,
    metadata: {
      type: exceptionType(seed),
      value: seed.errValue,
      title: seed.title,
      function: seed.room,
      filename: 'game.pgn',
    },
    numComments: seed.comments ?? 0,
    assignedTo: game.assignee
      ? {
          id: game.assignee.id,
          name: game.assignee.name,
          email: game.assignee.email,
          type: 'user',
        }
      : null,
    isBookmarked: false,
    isSubscribed: false,
    subscriptionDetails: null,
    hasSeen: seed.hasSeen ?? false,
    annotations: [],
    isUnhandled: game.isUnhandled,
    count: String(game.plies.length),
    userCount: game.spectators,
    firstSeen: game.firstSeen,
    lastSeen: game.lastSeen,
    stats: game.stats,
    filtered: null,
    lifetime: {
      count: String(game.plies.length),
      userCount: game.spectators,
      firstSeen: game.firstSeen,
      lastSeen: game.lastSeen,
      stats: game.stats,
    },
    participants: game.assignee
      ? [{...userFixture(game.assignee), type: 'user'}]
      : [{...userFixture(USERS[0]!), type: 'user'}],
    seenBy: seed.hasSeen ? [userFixture(USERS[0]!)] : [],
    activity: buildActivity(game),
    owners: [],
    inbox:
      substatus === 'new'
        ? {reason: 0, reason_details: null, date_added: game.lastSeen}
        : null,
    pluginActions: [],
    pluginIssues: [],
    pluginContexts: [],
    userReportCount: 0,
    latestEventId: game.eventId,
  };
}

function buildActivity(game: Game) {
  const items: any[] = [
    {
      id: `${game.id}-first`,
      type: 'first_seen',
      data: {},
      dateCreated: game.firstSeen,
      user: null,
    },
  ];
  if (game.seed.status === 'resolved') {
    items.unshift({
      id: `${game.id}-resolved`,
      type: 'set_resolved',
      data: {},
      dateCreated: game.lastSeen,
      user: userFixture(game.assignee ?? USERS[0]!),
    });
  }
  // Notes render their own author, so they read correctly without the org
  // member list an `assigned` entry would need to resolve.
  if (game.seed.comments) {
    items.unshift({
      id: `${game.id}-note`,
      type: 'note',
      data: {text: postGameRemark(game)},
      dateCreated: game.lastSeen,
      user: userFixture(game.assignee ?? USERS[0]!),
    });
  }
  return items;
}

const REMARKS: Record<string, string> = {
  blunder: 'Engine says this was winning two moves earlier. Look at the board.',
  mistake: 'Not fatal, but you gave back everything you built in the opening.',
  inaccuracy: 'Slightly off. The plan was fine, the move order was not.',
  brilliant: 'Genuinely good. Do that on purpose next time.',
  clean: 'Nothing to review here. Both players behaved themselves.',
};

function postGameRemark(game: Game) {
  const c = game.counts;
  const worst = c.blunder
    ? 'blunder'
    : c.mistake
      ? 'mistake'
      : c.inaccuracy
        ? 'inaccuracy'
        : c.brilliant
          ? 'brilliant'
          : 'clean';
  return `${REMARKS[worst]} (${biggestSwing(game)} was the swing, room ${game.seed.room}.)`;
}

/** The PGN "source file": one ply per line, so stack frames get source context. */
function pgnSourceLines(game: Game) {
  return game.plies.map(p => {
    const symbol = GRADE_SYMBOL[p.grade];
    const move = `${p.label}${symbol}`;
    return `${move.padEnd(16, ' ')}; ${p.grade.padEnd(10, ' ')} eval ${p.evalAfter}`;
  });
}

function buildFrames(game: Game) {
  const total = game.plies.length;
  const source = pgnSourceLines(game);
  const graded = new Set(
    Object.keys(game.seed.grades).map(k => parseInt(k, 10))
  );
  // Keep the frame list readable: the opening, every graded move, and the finish.
  const keep = new Set<number>();
  game.plies.forEach(p => {
    if (p.index < 4 || p.index >= total - 14 || graded.has(p.index)) {
      keep.add(p.index);
    }
  });

  return game.plies
    .filter(p => keep.has(p.index))
    .map(p => {
      const lineNo = p.index + 1;
      const context: Array<[number, string]> = [];
      for (let n = lineNo - 2; n <= lineNo + 2; n++) {
        if (n >= 1 && n <= source.length) {
          context.push([n, source[n - 1]!]);
        }
      }
      const isBad =
        p.grade === 'blunder' || p.grade === 'mistake' || p.grade === 'miss';
      return {
        filename: 'game.pgn',
        absPath: `/rooms/${game.seed.room}/game.pgn`,
        module: `${game.seed.eco}.${phaseFor(p.index, total)}`,
        package: p.index % 2 === 0 ? 'white' : 'black',
        platform: null,
        instructionAddr: null,
        symbolAddr: null,
        function: `${p.label}${GRADE_SYMBOL[p.grade]}`,
        rawFunction: p.san,
        symbol: null,
        context,
        lineNo,
        colNo: null,
        inApp: isBad || p.grade === 'brilliant',
        trust: null,
        errors: null,
        lock: null,
        sourceLink: null,
        minGroupingLevel: 0,
        vars: {
          grade: p.grade,
          eval: p.evalAfter,
          clock: p.clock,
          side: p.index % 2 === 0 ? game.seed.white : game.seed.black,
        },
      };
    });
}

function buildBreadcrumbs(game: Game) {
  const total = game.plies.length;
  const graded = new Set(Object.keys(game.seed.grades).map(k => parseInt(k, 10)));
  const endMs = NOW - game.seed.hoursAgo * 3600 * 1000;

  const crumbs: any[] = [
    {
      type: 'info',
      level: 'info',
      category: 'chess.game',
      message: `Game started in room ${game.seed.room} — ${game.seed.opening} (${game.seed.eco})`,
      timestamp: game.firstSeen,
      data: {
        room: game.seed.room,
        time_control: game.seed.timeControl,
        white: `${game.seed.white} (${game.seed.whiteElo})`,
        black: `${game.seed.black} (${game.seed.blackElo})`,
      },
    },
  ];

  game.plies
    .filter(p => p.index >= total - 24 || graded.has(p.index))
    .forEach(p => {
      const level = GRADE_LEVEL[p.grade];
      crumbs.push({
        type:
          level === 'fatal' || level === 'error'
            ? 'error'
            : level === 'warning'
              ? 'warning'
              : 'default',
        level,
        category: 'chess.move',
        message: `${p.label}${GRADE_SYMBOL[p.grade]}`,
        timestamp: new Date(endMs - (total - p.index) * 12000).toISOString(),
        data: {
          grade: p.grade,
          eval: p.evalAfter,
          clock: p.clock,
          side: p.index % 2 === 0 ? 'white' : 'black',
        },
      });
    });

  crumbs.push({
    type: 'error',
    level: game.seed.result === '1/2-1/2' ? 'warning' : 'error',
    category: 'chess.game',
    message: `Game over — ${game.seed.result} by ${game.seed.termination}`,
    timestamp: game.lastSeen,
    data: {
      result: game.seed.result,
      termination: game.seed.termination,
      final_fen: game.seed.finalFen,
      plies: total,
    },
  });

  return crumbs;
}

function fullPgn(game: Game) {
  const parts: string[] = [];
  game.plies.forEach((p, index) => {
    if (index % 2 === 0) {
      parts.push(`${index / 2 + 1}.`);
    }
    parts.push(`${p.san}${GRADE_SYMBOL[p.grade]}`);
  });
  parts.push(game.seed.result);
  return parts.join(' ');
}

function buildEvent(game: Game, eventId?: string): any {
  const {seed} = game;
  const c = game.counts;

  return {
    id: game.eventId,
    eventID: eventId?.length === 32 ? eventId : game.eventId,
    groupID: game.id,
    projectID: PROJECT_ID,
    title: seed.title,
    culprit: game.culprit,
    message: seed.errValue,
    platform: 'other',
    type: 'error',
    metadata: {
      type: exceptionType(seed),
      value: seed.errValue,
      title: seed.title,
      filename: 'game.pgn',
      function: seed.room,
    },
    size: 4096 + game.plies.length * 32,
    dist: null,
    location: 'game.pgn',
    crashFile: null,
    fingerprints: [game.gameId],
    errors: [],
    occurrence: null,
    resolvedWith: [],
    previousEventID: null,
    nextEventID: null,
    dateCreated: game.lastSeen,
    dateReceived: game.lastSeen,
    groupingConfig: {enhancements: '', id: 'newstyle:2023-01-11'},
    userReport: null,
    sdk: {name: 'pawn-patrol.javascript.board', version: '8.4.2'},
    release: null,
    user: {
      id: seed.result === '0-1' ? '2' : '1',
      username: game.loser,
      email: `${game.loser}@pawn-patrol.dev`,
      name: game.loser,
      ip_address: '127.0.0.1',
      data: {rating: seed.result === '0-1' ? seed.whiteElo : seed.blackElo},
    },
    tags: Object.entries(game.tags).map(([key, value]) => ({key, value})),
    contexts: {
      'Chess Game': {
        type: 'default',
        room: seed.room,
        game_id: game.gameId,
        result: seed.result,
        termination: seed.termination,
        opening: `${seed.opening} (${seed.eco})`,
        time_control: seed.timeControl,
        plies: game.plies.length,
        moves: fullPgn(game),
        final_fen: seed.finalFen,
      },
      Players: {
        type: 'default',
        white: seed.white,
        white_rating: seed.whiteElo,
        white_accuracy: `${seed.whiteAcc.toFixed(1)}%`,
        black: seed.black,
        black_rating: seed.blackElo,
        black_accuracy: `${seed.blackAcc.toFixed(1)}%`,
        winner:
          seed.result === '1-0'
            ? seed.white
            : seed.result === '0-1'
              ? seed.black
              : 'nobody',
      },
      'Engine Review': {
        type: 'default',
        engine: 'Stockfish 17.1 NNUE, depth 22',
        brilliant: c.brilliant ?? 0,
        best: c.best ?? 0,
        book: c.book ?? 0,
        inaccuracies: c.inaccuracy ?? 0,
        mistakes: c.mistake ?? 0,
        misses: c.miss ?? 0,
        blunders: c.blunder ?? 0,
        biggest_swing: biggestSwing(game),
      },
      Clock: {
        type: 'default',
        time_control: seed.timeControl,
        white_remaining: game.plies[game.plies.length - 2]?.clock ?? '0:00',
        black_remaining: game.plies[game.plies.length - 1]?.clock ?? '0:00',
        increment: `${seed.timeControl.split('+')[1] ?? '0'}s`,
        flagged: seed.termination === 'timeout',
      },
    },
    entries: [
      {
        type: 'exception',
        data: {
          excOmitted: null,
          hasSystemFrames: true,
          values: [
            {
              type: exceptionType(seed),
              value: seed.errValue,
              module: 'pawn_patrol.engine.review',
              threadId: null,
              rawStacktrace: null,
              mechanism: {
                type: 'chess.post_game_review',
                handled: false,
                data: {room: seed.room, game_id: game.gameId},
              },
              stacktrace: {
                framesOmitted: null,
                registers: null,
                hasSystemFrames: true,
                frames: buildFrames(game),
              },
            },
          ],
        },
      },
      {
        type: 'breadcrumbs',
        data: {values: buildBreadcrumbs(game)},
      },
      {
        type: 'message',
        data: {
          formatted: `${seed.title}\n\nFinal position (FEN): ${seed.finalFen}\n\n${fullPgn(game)}`,
        },
      },
    ],
    _meta: {},
  };
}

function biggestSwing(game: Game) {
  let worst = {label: '—', delta: 0};
  game.plies.forEach((p, index) => {
    if (index === 0) {
      return;
    }
    const before = parseFloat(game.plies[index - 1]!.evalAfter);
    const delta = Math.abs(parseFloat(p.evalAfter) - before);
    if (delta > worst.delta) {
      worst = {label: `${p.label}${GRADE_SYMBOL[p.grade]}`, delta};
    }
  });
  return `${worst.label} (${worst.delta.toFixed(2)})`;
}

// Tags

/** Distinct values for a tag key across every game, most common first. */
function tagValueCounts(key: string) {
  const counts = new Map<string, number>();
  ALL_GAMES.forEach(g => {
    const value = g.tags[key];
    if (value !== undefined) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Tags that genuinely vary from move to move. The facet card exists to show a
 * distribution, so these are what keep it from being five identical 100% bars —
 * and the staggered bars carry real information about the game.
 */
const PLY_FACETS: Record<string, (p: Ply) => string> = {
  phase: p => p.phase,
  piece: p => p.piece,
  eval_band: p => p.evalBand,
  time_pressure: p => p.timePressure,
  color: p => p.color,
  grade: p => p.grade,
};

const TAG_KEYS = [
  'phase',
  'piece',
  'eval_band',
  'grade',
  'result',
  'termination',
  'opening',
  'eco',
  'color',
  'time_pressure',
  'room',
  'time_control',
  'white',
  'black',
  'blunders',
  'mistakes',
  'accuracy',
  'annotation',
  'plies',
  'level',
  'engine',
];

function groupTags(game: Game, limit: number) {
  const keys = TAG_KEYS.filter(
    key => game.tags[key] !== undefined || key in PLY_FACETS
  );
  return keys.map(key => groupTag(game, key, limit));
}

function groupTag(game: Game, key: string, limit = 0) {
  const facet = PLY_FACETS[key];

  if (facet) {
    const counts = new Map<string, number>();
    game.plies.forEach(p => {
      const value = facet(p);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const shown = limit > 0 ? sorted.slice(0, limit) : sorted;
    return {
      key,
      name: key,
      uniqueValues: sorted.length,
      totalValues: game.plies.length,
      topValues: shown.map(([value, count]) => ({
        key,
        name: value,
        value,
        count,
        lastSeen: game.lastSeen,
        firstSeen: game.firstSeen,
        query: `${key}:"${value}"`,
      })),
    };
  }

  // Constant for the whole game — real Sentry has these too (`environment`).
  const value = game.tags[key];
  if (value === undefined) {
    return {key, name: key, uniqueValues: 0, totalValues: 0, topValues: []};
  }
  return {
    key,
    name: key,
    uniqueValues: 1,
    totalValues: game.plies.length,
    topValues: [
      {
        key,
        name: value,
        value,
        count: game.plies.length,
        lastSeen: game.lastSeen,
        firstSeen: game.firstSeen,
        query: `${key}:"${value}"`,
      },
    ],
  };
}

function tagValueRows(key: string) {
  return tagValueCounts(key).map(([value, count], i) => ({
    id: String(i + 1),
    key,
    name: value,
    value,
    count,
    lastSeen: iso(3600 * 1000),
    firstSeen: iso(14 * 86400 * 1000),
    email: null,
    username: null,
    ipAddress: null,
    identifier: null,
    query: `${key}:"${value}"`,
  }));
}

// Query params / search

function parseQs(search: string): Record<string, any> {
  const out: Record<string, any> = {};
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  params.forEach((value, key) => {
    if (key in out) {
      out[key] = ([] as string[]).concat(out[key], value);
    } else {
      out[key] = value;
    }
  });
  return out;
}

/**
 * The issue stream calls `api.requestPromise(path, {method: 'GET', data:
 * qs.stringify(params)})`, so params can arrive on the url, on `query`, or as a
 * urlencoded string in `data`. Normalise all three.
 */
function getParams(url: string, options: any): Record<string, any> {
  const qIndex = url.indexOf('?');
  const fromUrl = qIndex === -1 ? {} : parseQs(url.slice(qIndex));
  const {query, data} = options ?? {};
  const fromData =
    typeof data === 'string'
      ? parseQs(data)
      : data && typeof data === 'object' && (options?.method ?? 'GET') === 'GET'
        ? data
        : {};
  return {...fromUrl, ...fromData, ...query};
}

function asArray(value: any): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function tokenize(query: string): string[] {
  return query.match(/\S+:\[[^\]]*\]|\S+:"[^"]*"|"[^"]*"|\S+/g) ?? [];
}

function matchToken(game: Game, token: string): boolean {
  const negated = token.startsWith('!');
  const raw = negated ? token.slice(1) : token;
  const result = matchPositive(game, raw);
  return negated ? !result : result;
}

function listValues(rhs: string): string[] {
  if (rhs.startsWith('[') && rhs.endsWith(']')) {
    return rhs
      .slice(1, -1)
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  return [rhs.replace(/^"|"$/g, '')];
}

function matchPositive(game: Game, token: string): boolean {
  const colon = token.indexOf(':');
  if (colon === -1) {
    const needle = token.replace(/^"|"$/g, '').toLowerCase();
    return (
      game.seed.title.toLowerCase().includes(needle) ||
      game.culprit.toLowerCase().includes(needle) ||
      game.shortId.toLowerCase().includes(needle) ||
      game.seed.errType.toLowerCase().includes(needle)
    );
  }

  const key = token.slice(0, colon);
  const rhs = token.slice(colon + 1);
  const values = listValues(rhs);
  const seed = game.seed;

  switch (key) {
    case 'is':
      return values.some(v => {
        switch (v) {
          case 'unresolved':
            return seed.status === 'unresolved';
          case 'resolved':
            return seed.status === 'resolved';
          case 'ignored':
          case 'muted':
          case 'archived':
            return seed.status === 'ignored';
          case 'assigned':
            return game.assignee !== null;
          case 'unassigned':
            return game.assignee === null;
          case 'for_review':
            return substatusFor(game) === 'new' || substatusFor(game) === 'regressed';
          case 'regressed':
            return substatusFor(game) === 'regressed';
          case 'new':
            return substatusFor(game) === 'new';
          case 'ongoing':
            return substatusFor(game) === 'ongoing';
          case 'unhandled':
            return game.isUnhandled;
          default:
            return true;
        }
      });
    case 'issue.priority':
      return values.includes(seed.priority);
    case 'issue.category':
      return values.includes('error');
    case 'issue':
      return values.some(v => v.toLowerCase() === game.shortId.toLowerCase());
    case 'issue.id':
      return values.includes(game.id);
    case 'assigned':
    case 'assigned_or_suggested':
      return values.some(v =>
        v === 'me' || v === '#me'
          ? game.assignee?.id === USERS[0]!.id
          : game.assignee?.username === v || game.assignee?.email === v
      );
    case 'level':
      return values.includes(seed.level);
    case 'timesSeen':
    case 'times_seen':
      return compareNumeric(game.plies.length, rhs);
    case 'firstSeen':
    case 'lastSeen':
    case 'age':
      return true;
    default: {
      const tagValue = game.tags[key];
      if (tagValue === undefined) {
        return false;
      }
      if (/^[<>]=?/.test(rhs)) {
        return compareNumeric(Number(tagValue), rhs);
      }
      return values.some(v => v.toLowerCase() === tagValue.toLowerCase());
    }
  }
}

function compareNumeric(actual: number, rhs: string) {
  const match = rhs.match(/^([<>]=?)(-?[\d.]+)$/);
  if (!match) {
    return actual === Number(rhs);
  }
  const target = Number(match[2]);
  switch (match[1]) {
    case '>':
      return actual > target;
    case '>=':
      return actual >= target;
    case '<':
      return actual < target;
    default:
      return actual <= target;
  }
}

function searchGames(query: string | undefined): Game[] {
  const q = (query ?? '').trim();
  if (!q) {
    return ALL_GAMES;
  }
  const tokens = tokenize(q);
  return ALL_GAMES.filter(game => tokens.every(t => matchToken(game, t)));
}

function sortGames(games: Game[], sort: string | undefined): Game[] {
  const out = [...games];
  switch (sort) {
    case 'new':
      return out.sort((a, b) => Date.parse(b.firstSeen) - Date.parse(a.firstSeen));
    case 'freq':
      return out.sort((a, b) => b.plies.length - a.plies.length);
    case 'user':
      return out.sort((a, b) => b.spectators - a.spectators);
    case 'priority':
    case 'betterPriority':
    case 'trends':
    case 'progress':
      return out.sort(
        (a, b) =>
          PRIORITY_RANK[b.seed.priority]! - PRIORITY_RANK[a.seed.priority]! ||
          LEVEL_RANK[b.seed.level]! - LEVEL_RANK[a.seed.level]! ||
          Date.parse(b.lastSeen) - Date.parse(a.lastSeen)
      );
    case 'inbox':
      return out.sort((a, b) => Date.parse(b.firstSeen) - Date.parse(a.firstSeen));
    default:
      return out.sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
  }
}

/**
 * The issue stream reads `X-Hits`, `X-Max-Hits` and `Link` off the response
 * rather than the body, so those endpoints answer with the registry's
 * `chessResponse` wrapper.
 */
function withHeaders(body: any, headers: Record<string, string>) {
  return chessResponse(body, {headers});
}

function linkHeader(path: string, hasPrev: boolean, hasNext: boolean) {
  const base = `https://${ORG_SLUG}.sentry.io/api/0${path}`;
  return (
    `<${base}?&cursor=0:0:1>; rel="previous"; results="${hasPrev}"; cursor="0:0:1", ` +
    `<${base}?&cursor=0:25:0>; rel="next"; results="${hasNext}"; cursor="0:25:0"`
  );
}

function gameFromUrl(url: string): Game | undefined {
  const match = url.match(/\/issues\/([^/?]+)\//);
  if (!match) {
    return undefined;
  }
  const key = decodeURIComponent(match[1]!);
  return BY_ID.get(key) ?? BY_SHORT_ID.get(key.toLowerCase());
}

// Routes

const routes: ChessRoute[] = [
  // issue stream
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/(\?.*)?$/,
    handler: (url, options) => {
      const params = getParams(url, options);
      const limit = Number(params.limit ?? 25) || 25;
      const matched = sortGames(searchGames(params.query), params.sort);
      const page = matched.slice(0, limit).map(g => {
        const group = buildGroup(g);
        // collapse=stats means the stream fetches the sparkline separately
        if (asArray(params.collapse).includes('stats')) {
          delete group.stats;
          delete group.lifetime;
          delete group.filtered;
        }
        return group;
      });
      return withHeaders(page, {
        'X-Hits': String(matched.length),
        'X-Max-Hits': '1000',
        Link: linkHeader(
          `/organizations/${ORG_SLUG}/issues/`,
          false,
          matched.length > limit
        ),
      });
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues-stats\/(\?.*)?$/,
    handler: (url, options) => {
      const params = getParams(url, options);
      const ids = asArray(params.groups);
      const wanted = ids.length
        ? (ids.map(id => BY_ID.get(id)).filter(Boolean) as Game[])
        : ALL_GAMES;
      return wanted.map(g => ({
        id: g.id,
        count: String(g.plies.length),
        userCount: g.spectators,
        firstSeen: g.firstSeen,
        lastSeen: g.lastSeen,
        stats: g.stats,
        filtered: null,
        lifetime: {
          count: String(g.plies.length),
          userCount: g.spectators,
          firstSeen: g.firstSeen,
          lastSeen: g.lastSeen,
          stats: g.stats,
        },
      }));
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues-count\/(\?.*)?$/,
    handler: (url, options) => {
      const params = getParams(url, options);
      const queries = asArray(params.query);
      const out: Record<string, number> = {};
      (queries.length ? queries : ['']).forEach(q => {
        out[q] = searchGames(q).length;
      });
      return out;
    },
  },

  // issue detail
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/(\?.*)?$/,
    handler: url => {
      const game = gameFromUrl(url);
      return game ? buildGroup(game) : buildGroup(ALL_GAMES[0]!);
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/events\/[^/]+\/(\?.*)?$/,
    handler: url => {
      const game = gameFromUrl(url);
      const eventMatch = url.match(/\/events\/([^/?]+)\//);
      return buildEvent(game ?? ALL_GAMES[0]!, eventMatch?.[1]);
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/events\/(\?.*)?$/,
    handler: url => {
      const game = gameFromUrl(url);
      return game ? [buildEvent(game)] : [];
    },
  },

  // tags
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/tags\/([^/?]+)\/values\/(\?.*)?$/,
    handler: url => {
      const key = url.match(/\/tags\/([^/?]+)\/values\//)?.[1] ?? 'result';
      const game = gameFromUrl(url);
      if (!game) {
        return [];
      }
      // Works for both per-ply facets and whole-game constants.
      return groupTag(game, key).topValues.map((v, i) => ({
        ...v,
        id: String(i + 1),
        email: null,
        username: null,
        ipAddress: null,
        identifier: null,
      }));
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/tags\/([^/?]+)\/(\?.*)?$/,
    handler: url => {
      const key = url.match(/\/tags\/([^/?]+)\//)?.[1] ?? 'result';
      const game = gameFromUrl(url);
      return game ? groupTag(game, key) : {key, name: key, topValues: []};
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/tags\/(\?.*)?$/,
    handler: (url, options) => {
      const params = getParams(url, options);
      // useFlagsBackend=1 asks for feature flags, and chess games have none
      if (String(params.useFlagsBackend ?? '') === '1') {
        return [];
      }
      const game = gameFromUrl(url);
      return game ? groupTags(game, Number(params.limit ?? 0)) : [];
    },
  },

  // issue detail extras (empty but well-shaped)
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/activities\/(\?.*)?$/,
    handler: url => {
      const game = gameFromUrl(url);
      return {activity: game ? buildActivity(game) : []};
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/comments\/(\?.*)?$/,
    handler: () => [],
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/attachments\/(\?.*)?$/,
    handler: () => withHeaders([] as any[], {Link: ''}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/user-reports\/(\?.*)?$/,
    handler: () => withHeaders([] as any[], {Link: ''}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/first-last-release\/(\?.*)?$/,
    handler: () => ({firstRelease: null, lastRelease: null}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/current-release\/(\?.*)?$/,
    handler: () => ({currentRelease: null}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/external-issues\/(\?.*)?$/,
    handler: () => [],
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/integrations\/(\?.*)?$/,
    handler: () => [],
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/pull-requests\/(\?.*)?$/,
    handler: () => ({pullRequests: []}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/hashes\/(\?.*)?$/,
    handler: () => withHeaders([] as any[], {Link: ''}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/participants\/(\?.*)?$/,
    handler: url => {
      const game = gameFromUrl(url);
      return game?.assignee ? [userFixture(game.assignee)] : [];
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/related-issues\/(\?.*)?$/,
    handler: (url, options) => {
      const params = getParams(url, options);
      return {
        type: params.type ?? 'same_root_cause',
        data: [],
        meta: {event_id: '', trace_id: ''},
      };
    },
  },
  {
    // "similar issues" = other games that fell apart the same way
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/similar(-issues-embeddings)?\/(\?.*)?$/,
    handler: url => {
      const game = gameFromUrl(url);
      if (!game) {
        return withHeaders([] as any[], {Link: ''});
      }
      const similar = ALL_GAMES.filter(
        g => g.id !== game.id && g.seed.errType === game.seed.errType
      ).slice(0, 3);
      return withHeaders(
        similar.map(g => [
          buildGroup(g),
          {
            'exception:message:character-shingles': 0.94,
            'exception:stacktrace:application-chunks': 0.81,
            'exception:stacktrace:pairs': 0.77,
          },
        ]),
        {Link: ''}
      );
    },
  },
  // autofix/setup is owned by domains/seer.tsx — do not add it here (a games
  // route shadows seer's and its legacy shape breaks the Seer drawer quota check).

  // issue stream chrome
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/group-search-views\/starred\/(\?.*)?$/,
    handler: () => SAVED_VIEWS,
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/group-search-views\/(\?.*)?$/,
    handler: () => withHeaders([...SAVED_VIEWS], {Link: ''}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/group-search-views\/[^/]+\/(\?.*)?$/,
    handler: url => {
      const id = url.match(/group-search-views\/([^/?]+)\//)?.[1];
      return SAVED_VIEWS.find(v => v.id === id) ?? SAVED_VIEWS[0];
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/searches\/(\?.*)?$/,
    handler: () => [],
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/recent-searches\/(\?.*)?$/,
    handler: () => [],
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/sent-first-event\/(\?.*)?$/,
    handler: () => ({sentFirstEvent: true}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/(monitors|uptime)-count\/(\?.*)?$/,
    handler: () => ({counts: {active: 0, disabled: 0, total: 0}}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/seer\/supergroups\/by-group\/(\?.*)?$/,
    handler: () => ({data: []}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/flags\/logs\/(\?.*)?$/,
    handler: () => withHeaders({data: []} as any, {Link: ''}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/open-periods\/(\?.*)?$/,
    handler: () => withHeaders([] as any[], {Link: ''}),
  },
  {
    method: 'GET',
    url: /\/projects\/[^/]+\/[^/]+\/events\/[^/]+\/owners\/(\?.*)?$/,
    handler: () => ({owners: [], rules: [], rule: null}),
  },
  {
    // `useActionableItemsWithProguardErrors` spreads `.errors`, so an array
    // response (the registry's default) would throw.
    method: 'GET',
    url: /\/projects\/[^/]+\/[^/]+\/events\/[^/]+\/actionable-items\/(\?.*)?$/,
    handler: () => ({errors: []}),
  },
  {
    method: 'GET',
    url: /\/projects\/[^/]+\/[^/]+\/events\/[^/]+\/committers\/(\?.*)?$/,
    handler: () => ({committers: []}),
  },
  {
    // No repo behind game.pgn, so every frame reports "not configured".
    method: 'GET',
    url: /\/projects\/[^/]+\/[^/]+\/stacktrace-link\/(\?.*)?$/,
    handler: () => ({config: null, sourceUrl: null, integrations: []}),
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/sentry-app-components\/(\?.*)?$/,
    handler: () => [],
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/events\/[^/]+\/committers\/(\?.*)?$/,
    handler: () => ({committers: []}),
  },

  // search bar tag autocomplete
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/tags\/([^/?]+)\/values\/(\?.*)?$/,
    handler: url => {
      const key = url.match(/\/tags\/([^/?]+)\/values\//)?.[1] ?? 'result';
      return tagValueRows(key);
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/tags\/(\?.*)?$/,
    handler: (url, options) => {
      const params = getParams(url, options);
      if (String(params.useFlagsBackend ?? '') === '1') {
        return [];
      }
      return TAG_KEYS.map(key => ({
        key,
        name: key,
        totalValues: tagValueCounts(key).reduce((sum, [, c]) => sum + c, 0),
      }));
    },
  },

  // mutations: echo enough for the optimistic UI to settle
  {
    method: 'PUT',
    url: /\/organizations\/[^/]+\/issues\/(\?.*)?$/,
    handler: (_url, options) => ({...options?.data}),
  },
  {
    method: 'PUT',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/(\?.*)?$/,
    handler: (url, options) => {
      const game = gameFromUrl(url);
      return {...(game ? buildGroup(game) : {}), ...options?.data};
    },
  },
  {
    method: 'DELETE',
    url: /\/organizations\/[^/]+\/issues\/(\?.*)?$/,
    handler: () => ({}),
  },
  {
    method: 'PUT',
    url: /\/projects\/[^/]+\/[^/]+\/issues\/(\?.*)?$/,
    handler: (_url, options) => ({...options?.data}),
  },
  {
    method: 'POST',
    url: /\/organizations\/[^/]+\/issues\/[^/]+\/comments\/(\?.*)?$/,
    handler: (_url, options) => ({
      id: String(Date.now()),
      type: 'note',
      data: {text: options?.data?.text ?? ''},
      dateCreated: new Date().toISOString(),
      user: userFixture(USERS[0]!),
    }),
  },

  // Issue-details charts. `/events-stats/` and `/events/` are also Insights
  // endpoints, so these patterns deliberately require the issue-details
  // referrer — anything else falls through to the Insights domain.
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/events-stats\/\?[^#]*referrer=issue[_-]details/,
    handler: (url, options) => {
      const params = getParams(url, options);
      const game = gameFromShortIdQuery(String(params.query ?? '')) ?? ALL_GAMES[0]!;
      const buckets = gameSeriesBuckets(game, params);
      const toSeries = (total: number) => {
        // The chart total has to equal the header's "Events (total)" exactly —
        // a period count that disagrees with the all-time count reads as a bug.
        const active = buckets.filter(b => b.inGame);
        const parts = distribute(total, active.length);
        const counts = new Map(active.map((b, n) => [b.ts, parts[n] ?? 0]));
        return {
          data: buckets.map(b => [b.ts, [{count: counts.get(b.ts) ?? 0}]]),
          order: 0,
          isMetricsData: false,
          start: buckets[0]!.ts,
          end: buckets[buckets.length - 1]!.ts,
          meta: {fields: {}, units: {}},
        };
      };
      return {
        'count()': toSeries(game.plies.length),
        'count_unique(user)': toSeries(game.spectators),
      };
    },
  },
  {
    method: 'GET',
    url: /\/organizations\/[^/]+\/events\/\?[^#]*referrer=issue[_-]details/,
    handler: (url, options) => {
      const params = getParams(url, options);
      const game = gameFromShortIdQuery(String(params.query ?? '')) ?? ALL_GAMES[0]!;
      return {
        data: [{'count_unique(user)': game.spectators}],
        meta: {fields: {'count_unique(user)': 'integer'}, units: {}},
      };
    },
  },
];

function durationSeconds(value: string, fallback: number) {
  const match = /^(\d+)([smhdw])$/.exec(value ?? '');
  if (!match) {
    return fallback;
  }
  const unit = {s: 1, m: 60, h: 3600, d: 86400, w: 604800}[match[2]!]!;
  return Number(match[1]) * unit;
}

/**
 * Buckets covering the window the graph asked for, flagged with whether the
 * game was actually being played during them. A game is a single burst of
 * events, so at a daily interval it shows up as one bar.
 */
function gameSeriesBuckets(game: Game, params: Record<string, any>) {
  const requested = Math.max(60, durationSeconds(String(params.interval ?? '1h'), 3600));

  // The default "Since First Seen" filter sends start/end instead of a period.
  const explicitEnd = Date.parse(String(params.end ?? ''));
  const explicitStart = Date.parse(String(params.start ?? ''));
  const hasRange = !isNaN(explicitEnd) && !isNaN(explicitStart);

  const periodSec = hasRange
    ? (explicitEnd - explicitStart) / 1000
    : durationSeconds(String(params.statsPeriod ?? '14d'), 14 * 86400);

  // Widen the interval rather than truncating the window. Capping the bucket
  // count alone would silently return a range shorter than the one asked for,
  // and an old game would fall outside it and chart as empty.
  const MAX_BUCKETS = 1000;
  const intervalSec = Math.max(requested, Math.ceil(periodSec / MAX_BUCKETS));
  const count = Math.min(Math.max(Math.ceil(periodSec / intervalSec), 2), MAX_BUCKETS);

  const endSec = hasRange ? Math.floor(explicitEnd / 1000) : Math.floor(NOW / 1000);
  const startedSec = Math.floor(Date.parse(game.firstSeen) / 1000);
  const endedSec = Math.floor(Date.parse(game.lastSeen) / 1000);

  const buckets: Array<{inGame: boolean; ts: number}> = [];
  for (let i = count - 1; i >= 0; i--) {
    const ts = endSec - i * intervalSec;
    buckets.push({ts, inGame: ts + intervalSec > startedSec && ts <= endedSec});
  }

  // A game shorter than one bucket still deserves a bar — but only if it was
  // played inside the requested window at all.
  const windowStart = buckets[0]!.ts - intervalSec;
  if (!buckets.some(b => b.inGame) && endedSec > windowStart && endedSec <= endSec) {
    let nearest = buckets[0]!;
    for (const b of buckets) {
      if (Math.abs(b.ts - endedSec) < Math.abs(nearest.ts - endedSec)) {
        nearest = b;
      }
    }
    nearest.inGame = true;
  }

  return buckets;
}

function gameFromShortIdQuery(query: string): Game | undefined {
  const short = query.match(/issue:\s*([A-Za-z0-9-]+)/)?.[1];
  if (short) {
    return BY_SHORT_ID.get(short.toLowerCase());
  }
  const id = query.match(/issue\.id:\s*\[?(\d+)/)?.[1];
  return id ? BY_ID.get(id) : undefined;
}

/**
 * These mirror Sentry's real default views (Prioritized / For Review /
 * Regressed / Assigned to me), which is what makes the shelf read as a
 * workspace rather than a demo.
 */
const SAVED_VIEW_SEEDS: Array<[string, string, string, number]> = [
  ['Worst blunders', 'is:unresolved blunders:>0', 'freq', 9],
  ['Needs analysis', 'is:for_review', 'new', 6],
  ['Same mistake again', 'is:regressed', 'date', 5],
  ['Playing Black', 'is:unresolved color:black', 'date', 3],
  ['Thrown away', 'is:unresolved result:0-1 blunders:>0', 'priority', 4],
  ['Time scrambles', 'time_pressure:true', 'date', 2],
  ['Lost on time', 'termination:timeout', 'date', 2],
  ['Endgame technique', 'phase:endgame', 'date', 1],
  ['Draws I should have won', 'result:1/2-1/2 blunders:>0', 'date', 3],
  ['Clean games', 'is:resolved accuracy:excellent', 'new', 1],
];

const SAVED_VIEWS: any[] = SAVED_VIEW_SEEDS.map(([name, query, sort, stars], i) => ({
  id: String(i + 1),
  name,
  query,
  querySort: sort,
  projects: [Number(PROJECT_ID)],
  environments: [],
  timeFilters: {start: null, end: null, period: '14d', utc: null},
  lastVisited: null,
  visibility: 'organization',
  starred: true,
  stars,
  createdBy: userFixture(USERS[0]!),
  dateCreated: '2026-08-01',
  dateUpdated: '2026-08-01',
}));

// eslint-disable-next-line @sentry/no-default-exports -- registry contract
export default routes;

