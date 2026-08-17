import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

/**
 * Shared chessboard rendering primitives.
 *
 * The replay detail page and the live Play tab both draw from this file so the
 * two boards stay pixel-identical. Everything here is presentational — there
 * is no move legality, no clock, no data fetching. Callers own game state and
 * hand this a 64-entry board plus whichever squares they want highlighted.
 *
 * Board indexing is rank-major from a8: index 0 is a8, 7 is h8, 63 is h1.
 * A square holds a piece letter (uppercase = white) or `.` for empty.
 */

export const FILES = 'abcdefgh';

/** A 64-entry board. Index 0 = a8, index 63 = h1. */
export type BoardSquares = string[];

/**
 * Highlight roles, mapped to Sentry's semantic colors:
 *   move   - the last move played (warning; the chess convention, and it
 *            survives on both square colors where accent purple does not)
 *   bad    - an annotated move: blunder or mistake (danger)
 *   select - the piece the player has picked up (accent)
 *   target - a square that piece can legally move to (success)
 */
export type SquareHighlight = 'move' | 'bad' | 'select' | 'target';

/**
 * Both colours use the solid ("black") glyphs and are told apart by fill. The
 * hollow white glyphs wash out against a coloured square.
 */
export const PIECE_GLYPH: Record<string, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

const PIECE_VALUE: Record<string, number> = {p: 1, n: 3, b: 3, r: 5, q: 9, k: 0};

export function squareIndex(name: string) {
  return (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]!);
}

export function squareName(index: number) {
  return `${FILES[index % 8]}${8 - Math.floor(index / 8)}`;
}

export function isWhitePiece(piece: string) {
  return piece !== '.' && piece === piece.toUpperCase();
}

export function startingBoard(): BoardSquares {
  const board = Array.from({length: 64}, () => '.');
  const back = 'rnbqkbnr';
  for (let i = 0; i < 8; i++) {
    board[i] = back[i]!;
    board[8 + i] = 'p';
    board[48 + i] = 'P';
    board[56 + i] = back[i]!.toUpperCase();
  }
  return board;
}

/**
 * Reads the placement field of a FEN into a board. Ranks run 8 down to 1 and
 * files a through h, which is this module's index order, so placement maps
 * straight across.
 *
 * Use this rather than replaying moves whenever you hold an authoritative
 * position — a live game gets a fresh FEN on every server broadcast, and
 * re-deriving from history risks drifting from what the server believes.
 */
export function boardFromFen(fen: string): BoardSquares {
  const board = Array.from({length: 64}, () => '.');
  const placement = fen.split(' ')[0] ?? '';
  let index = 0;

  for (const char of placement) {
    if (char === '/') {
      continue;
    }
    if (/\d/.test(char)) {
      index += Number(char);
      continue;
    }
    board[index] = char;
    index += 1;
  }

  return board;
}

/**
 * Applies a move to a board and returns a new one. Castling and en passant are
 * inferred from the piece and the geometry, so callers only need from/to plus
 * a promotion piece where relevant.
 */
export function applyMove(
  board: BoardSquares,
  from: number,
  to: number,
  promo?: string | null
): BoardSquares {
  const next = board.slice();
  const piece = next[from]!;
  const isPawn = piece.toUpperCase() === 'P';
  const white = isWhitePiece(piece);

  next[from] = '.';
  next[to] = promo ? (white ? promo.toUpperCase() : promo.toLowerCase()) : piece;

  // En passant: a pawn changed file onto an empty square, so the captured pawn
  // sits beside the origin square rather than on the destination.
  if (isPawn && from % 8 !== to % 8 && board[to] === '.') {
    next[Math.floor(from / 8) * 8 + (to % 8)] = '.';
  }

  // Castling: the king moved two files, so the rook jumps over it.
  if (piece.toUpperCase() === 'K' && Math.abs((from % 8) - (to % 8)) === 2) {
    const rank = Math.floor(to / 8) * 8;
    const kingside = to % 8 === 6;
    next[rank + (kingside ? 5 : 3)] = next[rank + (kingside ? 7 : 0)]!;
    next[rank + (kingside ? 7 : 0)] = '.';
  }

  return next;
}

/** Material balance in pawns, positive means white is up. */
export function materialBalance(board: BoardSquares) {
  return board.reduce((total, piece) => {
    if (piece === '.') {
      return total;
    }
    const value = PIECE_VALUE[piece.toLowerCase()] ?? 0;
    return isWhitePiece(piece) ? total + value : total - value;
  }, 0);
}

export function formatEval(balance: number) {
  if (balance === 0) {
    return '0.0';
  }
  return `${balance > 0 ? '+' : '−'}${Math.abs(balance).toFixed(1)}`;
}

interface ChessBoardProps {
  board: BoardSquares;
  /** Draw from black's side. */
  flipped?: boolean;
  /** Square index -> highlight role. */
  highlights?: Record<number, SquareHighlight>;
  /** Supply to make squares clickable (the Play tab does; replays don't). */
  onSquareClick?: (index: number) => void;
}

export function ChessBoard({
  board,
  flipped = false,
  highlights,
  onSquareClick,
}: ChessBoardProps) {
  const order = useMemo(() => {
    const indexes = Array.from({length: 64}, (_, i) => i);
    return flipped ? indexes.reverse() : indexes;
  }, [flipped]);

  return (
    <BoardGrid>
      {order.map(index => {
        const file = index % 8;
        const rank = Math.floor(index / 8);
        const piece = board[index] ?? '.';
        const isDark = (file + rank) % 2 === 1;

        return (
          <Square
            key={index}
            isDark={isDark}
            highlight={highlights?.[index]}
            isInteractive={Boolean(onSquareClick)}
            onClick={onSquareClick ? () => onSquareClick(index) : undefined}
            aria-label={squareName(index)}
          >
            {file === (flipped ? 7 : 0) ? (
              <Coordinate isDark={isDark} corner="rank">
                {8 - rank}
              </Coordinate>
            ) : null}
            {rank === (flipped ? 0 : 7) ? (
              <Coordinate isDark={isDark} corner="file">
                {FILES[file]}
              </Coordinate>
            ) : null}
            {piece === '.' ? null : (
              <Piece isWhite={isWhitePiece(piece)}>{PIECE_GLYPH[piece.toLowerCase()]}</Piece>
            )}
          </Square>
        );
      })}
    </BoardGrid>
  );
}

/**
 * The chess analogue of Sentry Replay's activity strip: white fills from the
 * bottom, black from the top, split at the current evaluation. Sits flush
 * against `BoardFrame`'s left edge.
 */
export function EvalBar({balance}: {balance: number}) {
  // Clamp to ±10 pawns so a lopsided endgame doesn't peg the bar flat.
  const whiteShare = Math.max(6, Math.min(94, 50 + (balance / 10) * 44));

  return (
    <EvalColumn aria-label={`Material balance ${formatEval(balance)}`}>
      <EvalFill style={{height: `${whiteShare}%`}} />
      <EvalReadout isLosing={balance < 0}>{formatEval(balance)}</EvalReadout>
    </EvalColumn>
  );
}

// -- styles ------------------------------------------------------------------

/**
 * Wraps `EvalBar` + `BoardFrame` side by side. `maxWidth` is per-page: a board
 * sharing a panel with other content wants the default, a board that IS the
 * page wants more.
 */
export const BoardRow = styled('div')<{maxWidth?: string}>`
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: ${p => p.maxWidth ?? '520px'};
`;

/**
 * Establishes the container query the piece glyphs size against, so a board
 * scales cleanly at any width.
 */
export const BoardFrame = styled('div')`
  flex: 1;
  min-width: 0;
  container-type: inline-size;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 0 ${p => p.theme.radius.xs} ${p => p.theme.radius.xs} 0;
  overflow: hidden;
`;

/**
 * Rows are explicitly `1fr` — left to `auto` they size to their content, so
 * occupied ranks inflate, empty ranks collapse, and the board reflows as
 * pieces move.
 */
export const BoardGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  aspect-ratio: 1;
  width: 100%;
`;

/**
 * Surface tones, not saturated brand purple: the board covers a third of the
 * page and must not outshout the nav or the primary action. The purple is
 * spent on state (highlights) instead.
 */
export const Square = styled('div')<{
  isDark: boolean;
  highlight?: SquareHighlight;
  isInteractive?: boolean;
}>`
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  cursor: ${p => (p.isInteractive ? 'pointer' : 'default')};
  background-color: ${p =>
    p.isDark ? p.theme.tokens.background.secondary : p.theme.tokens.background.tertiary};
  background-image: ${p =>
    p.isDark
      ? 'none'
      : `linear-gradient(${p.theme.tokens.background.transparent.accent.muted}, ${p.theme.tokens.background.transparent.accent.muted})`};
  border: 3px solid ${p => highlightColor(p.highlight, p.theme)};
`;

function highlightColor(highlight: SquareHighlight | undefined, theme: Theme) {
  switch (highlight) {
    case 'bad':
      return theme.tokens.border.danger.vibrant;
    case 'move':
      return theme.tokens.border.warning.vibrant;
    case 'select':
      return theme.tokens.border.accent.vibrant;
    case 'target':
      return theme.tokens.border.success.vibrant;
    default:
      return 'transparent';
  }
}

export const Piece = styled('span')<{isWhite: boolean}>`
  font-size: 8cqw;
  line-height: 1;
  user-select: none;
  color: ${p =>
    p.isWhite ? p.theme.tokens.content.onVibrant.light : p.theme.tokens.content.onVibrant.dark};
  -webkit-text-stroke: 1px
    ${p => (p.isWhite ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.85)')};
`;

/** Labels take the opposite square's colour so they read on both. */
export const Coordinate = styled('span')<{corner: 'rank' | 'file'; isDark: boolean}>`
  position: absolute;
  ${p => (p.corner === 'rank' ? 'top: 3px; left: 4px;' : 'bottom: 2px; right: 4px;')}
  font-size: 11px;
  font-weight: 600;
  opacity: 0.7;
  pointer-events: none;
  color: ${p =>
    p.isDark ? p.theme.tokens.content.secondary : p.theme.tokens.content.primary};
`;

const EvalColumn = styled('div')`
  position: relative;
  width: 16px;
  flex: none;
  overflow: hidden;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-right: 0;
  border-radius: ${p => p.theme.radius.xs} 0 0 ${p => p.theme.radius.xs};
  background: ${p => p.theme.tokens.graphics.neutral.vibrant};

  /* the even-material line, so the split is readable at a glance */
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    border-top: 1px dashed ${p => p.theme.tokens.border.primary};
  }
`;

/** White's share, filling from the bottom the way an engine eval bar does. */
const EvalFill = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${p => p.theme.tokens.background.secondary};
  transition: height 200ms ease-out;
`;

const EvalReadout = styled('span')<{isLosing: boolean}>`
  position: absolute;
  left: 0;
  right: 0;
  ${p => (p.isLosing ? 'bottom: 2px;' : 'top: 2px;')}
  text-align: center;
  font-size: 9px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${p =>
    p.isLosing ? p.theme.tokens.content.primary : p.theme.tokens.content.onVibrant.light};
`;
