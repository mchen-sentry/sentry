import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {PieceColor} from 'sentry/chessMode/useChessSocket';

/**
 * Interactive board for the Play tab.
 *
 * Deliberately a sibling of `chessReplayDetail`'s read-only board rather than a
 * fork of it: the square palette, piece treatment and coordinate labels are
 * matched so Play and Replays read as one product, but this one owns selection,
 * legal-move dots and click-to-move, which a replay board has no use for.
 */

const PIECE_GLYPH: Record<string, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export interface BoardSquare {
  /** Lowercase piece letter, or null for an empty square. */
  piece: string | null;
  square: string;
  isWhite?: boolean;
}

/** Expand a FEN's placement field into 64 squares, a8 first. */
export function squaresFromFen(fen: string): BoardSquare[] {
  const placement = fen.split(' ')[0] ?? '';
  const out: BoardSquare[] = [];
  let rank = 8;
  let fileIndex = 0;

  for (const char of placement) {
    if (char === '/') {
      rank -= 1;
      fileIndex = 0;
      continue;
    }
    if (/\d/.test(char)) {
      const empties = Number(char);
      for (let i = 0; i < empties; i++) {
        out.push({square: `${FILES[fileIndex]}${rank}`, piece: null});
        fileIndex += 1;
      }
      continue;
    }
    out.push({
      square: `${FILES[fileIndex]}${rank}`,
      piece: char.toLowerCase(),
      isWhite: char === char.toUpperCase(),
    });
    fileIndex += 1;
  }

  return out;
}

interface PlayBoardProps {
  fen: string;
  /** Squares the selected piece may move to. */
  legalTargets: string[];
  onSelect: (square: string) => void;
  /** Which side is at the bottom. */
  orientation: PieceColor;
  /** Square of the king in check, if any. */
  checkSquare?: string | null;
  /** The move just played, highlighted from/to. */
  lastMove?: {from: string; to: string} | null;
  selected?: string | null;
}

export function PlayBoard({
  fen,
  orientation,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  onSelect,
}: PlayBoardProps) {
  const squares = useMemo(() => {
    const all = squaresFromFen(fen);
    return orientation === 'w' ? all : all.toReversed();
  }, [fen, orientation]);

  const targets = useMemo(() => new Set(legalTargets), [legalTargets]);

  return (
    <BoardFrame>
      <BoardGrid>
        {squares.map(({square, piece, isWhite}) => {
          const file = square.charCodeAt(0) - 97;
          const rank = Number(square[1]);
          const isDark = (file + rank) % 2 === 0;
          const isTarget = targets.has(square);

          return (
            <Square
              key={square}
              isDark={isDark}
              isSelected={selected === square}
              isLastMove={lastMove?.from === square || lastMove?.to === square}
              isCheck={checkSquare === square}
              onClick={() => onSelect(square)}
              aria-label={piece ? `${square} ${piece}` : square}
            >
              {rank === (orientation === 'w' ? 1 : 8) && (
                <Coordinate corner="file" isDark={isDark}>
                  {square[0]}
                </Coordinate>
              )}
              {file === (orientation === 'w' ? 0 : 7) && (
                <Coordinate corner="rank" isDark={isDark}>
                  {rank}
                </Coordinate>
              )}
              {piece && <Piece isWhite={Boolean(isWhite)}>{PIECE_GLYPH[piece]}</Piece>}
              {isTarget && (piece ? <CaptureRing /> : <MoveDot />)}
            </Square>
          );
        })}
      </BoardGrid>
    </BoardFrame>
  );
}

const BoardFrame = styled('div')`
  container-type: inline-size;
  width: 100%;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

/**
 * Rows are explicitly `1fr`. Left to `auto` they size to their content, so
 * occupied ranks inflate and empty ranks collapse as pieces move.
 */
const BoardGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  aspect-ratio: 1;
  width: 100%;
`;

/**
 * Surface tones rather than saturated brand purple: the board is the largest
 * thing on the page and must not outshout the nav or the primary action. The
 * purple is spent on state — selection and the last move.
 */
const Square = styled('div')<{
  isCheck: boolean;
  isDark: boolean;
  isLastMove: boolean;
  isSelected: boolean;
}>`
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  cursor: pointer;
  background-color: ${p =>
    p.isDark ? p.theme.tokens.background.secondary : p.theme.tokens.background.tertiary};
  background-image: ${p =>
    p.isDark
      ? 'none'
      : `linear-gradient(${p.theme.tokens.background.transparent.accent.muted}, ${p.theme.tokens.background.transparent.accent.muted})`};
  border: 3px solid
    ${p =>
      p.isCheck
        ? p.theme.tokens.border.danger.vibrant
        : p.isSelected || p.isLastMove
          ? p.theme.tokens.border.accent.vibrant
          : 'transparent'};

  &:hover {
    filter: brightness(1.12);
  }
`;

const Piece = styled('span')<{isWhite: boolean}>`
  font-size: 8cqw;
  line-height: 1;
  user-select: none;
  pointer-events: none;
  color: ${p =>
    p.isWhite
      ? p.theme.tokens.content.onVibrant.light
      : p.theme.tokens.content.onVibrant.dark};
  -webkit-text-stroke: 1px
    ${p => (p.isWhite ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.85)')};
`;

/** Empty legal destination. */
const MoveDot = styled('span')`
  position: absolute;
  width: 22%;
  height: 22%;
  border-radius: 50%;
  pointer-events: none;
  background: ${p => p.theme.tokens.graphics.accent.vibrant};
  opacity: 0.55;
`;

/** Occupied legal destination — a ring, so the piece stays readable. */
const CaptureRing = styled('span')`
  position: absolute;
  inset: 6%;
  border-radius: 50%;
  pointer-events: none;
  border: 4px solid ${p => p.theme.tokens.graphics.accent.vibrant};
  opacity: 0.65;
`;

const Coordinate = styled('span')<{corner: 'file' | 'rank'; isDark: boolean}>`
  position: absolute;
  ${p => (p.corner === 'rank' ? 'top: 3px; left: 4px;' : 'bottom: 2px; right: 4px;')}
  font-size: 11px;
  font-weight: 600;
  opacity: 0.7;
  pointer-events: none;
  color: ${p =>
    p.isDark ? p.theme.tokens.content.secondary : p.theme.tokens.content.primary};
`;
