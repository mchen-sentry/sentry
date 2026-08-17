import {useMemo} from 'react';

import {
  BoardFrame,
  boardFromFen,
  BoardRow,
  ChessBoard,
  EvalBar,
  materialBalance,
  squareIndex,
  squareName,
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
    <BoardRow maxWidth={`${PLAY_BOARD_MAX_WIDTH}px`}>
      <EvalBar balance={materialBalance(board)} />
      <BoardFrame>
        <ChessBoard
          board={board}
          flipped={orientation === 'b'}
          highlights={highlights}
          onSquareClick={index => onSelect(squareName(index))}
        />
      </BoardFrame>
    </BoardRow>
  );
}

/**
 * The shared default of 520px suits the replay detail page, where the board is
 * one panel among several. Here it is the whole page, so it gets more room.
 * The seat rows above and below match this so the clocks line up with the board.
 */
export const PLAY_BOARD_MAX_WIDTH = 620;
