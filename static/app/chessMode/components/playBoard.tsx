import {useMemo} from 'react';
import styled from '@emotion/styled';

import {
  BoardFrame,
  BoardRow,
  ChessBoard,
  EvalBar,
  materialBalance,
  squareIndex,
  squareName,
  type BoardSquares,
  type SquareHighlight,
} from 'sentry/chessMode/components/chessBoard';
import type {PieceColor} from 'sentry/chessMode/useChessSocket';

/**
 * The Play tab's board.
 *
 * Rendering lives in REPLAYS' shared `chessBoard` primitives so Play and
 * Replays stay pixel-identical; this file is only the adapter between them and
 * live game state. It converts the server's FEN into their 64-entry board and
 * translates square names to indices at the boundary, so everything above it
 * can keep speaking algebraic notation like chess.js and the wire format do.
 */

/**
 * Expand a FEN's placement field into a 64-entry board (index 0 = a8).
 *
 * The shared module builds boards by applying moves from the starting
 * position, which suits a replay walking its own move list. A live table gets
 * an authoritative FEN on every broadcast, and re-deriving the position from
 * history would risk drifting away from what the server actually thinks.
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

interface PlayBoardProps {
  fen: string;
  /** Squares the selected piece may move to. */
  legalTargets: string[];
  onSelect: (square: string) => void;
  /** Which side is at the bottom. */
  orientation: PieceColor;
  /** Square of the king in check, if any. */
  checkSquare?: string | null;
  /** The move just played. */
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
  const board = useMemo(() => boardFromFen(fen), [fen]);

  const highlights = useMemo(() => {
    const out: Record<number, SquareHighlight> = {};
    // Assigned weakest first so the more urgent role wins the square: the last
    // move is context, the piece you are holding and its destinations are the
    // current interaction, and a king in check outranks all of it.
    if (lastMove) {
      out[squareIndex(lastMove.from)] = 'move';
      out[squareIndex(lastMove.to)] = 'move';
    }
    for (const target of legalTargets) {
      out[squareIndex(target)] = 'target';
    }
    if (selected) {
      out[squareIndex(selected)] = 'select';
    }
    if (checkSquare) {
      out[squareIndex(checkSquare)] = 'bad';
    }
    return out;
  }, [lastMove, legalTargets, selected, checkSquare]);

  return (
    <PlayBoardRow>
      <EvalBar balance={materialBalance(board)} />
      <BoardFrame>
        <ChessBoard
          board={board}
          flipped={orientation === 'b'}
          highlights={highlights}
          onSquareClick={index => onSelect(squareName(index))}
        />
      </BoardFrame>
    </PlayBoardRow>
  );
}

/**
 * The shared `BoardRow` caps at 520px, which suits the replay detail page where
 * the board is one panel among several. Here the board is the whole point, so
 * it gets more room. Extended rather than edited so replays keeps its own size.
 */
export const PLAY_BOARD_MAX_WIDTH = 620;

const PlayBoardRow = styled(BoardRow)`
  max-width: ${PLAY_BOARD_MAX_WIDTH}px;
`;
