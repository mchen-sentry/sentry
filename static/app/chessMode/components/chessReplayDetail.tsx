import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Slider} from '@sentry/scraps/slider';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconNext} from 'sentry/icons/iconNext';
import {IconPause} from 'sentry/icons/iconPause';
import {IconPlay} from 'sentry/icons/iconPlay';
import {IconPrevious} from 'sentry/icons/iconPrevious';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {ChessGame} from 'sentry/chessMode/domains/replays';
import {CHESS_GAMES, findGame} from 'sentry/chessMode/domains/replays';

/**
 * The Session Replay detail page, but the "session" is a chess game.
 *
 * Rather than feeding rrweb a synthetic recording, this component takes over
 * the `:replaySlug` route and plays the game back on a board. Move data is
 * hardcoded in `chessMode/domains/replays` as verified `SAN/fromto` pairs, so
 * the only logic here is applying a move to a board array.
 */

const FILES = 'abcdefgh';

const PIECE_GLYPH: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

const PIECE_VALUE: Record<string, number> = {p: 1, n: 3, b: 3, r: 5, q: 9, k: 0};

const SPEEDS = [0.5, 1, 2, 4] as const;
const BASE_MS_PER_PLY = 900;

type Ply = {
  from: number;
  promo: string | null;
  san: string;
  to: number;
};

function squareIndex(name: string) {
  return (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]!);
}

function startingBoard() {
  const board = new Array<string>(64).fill('.');
  const back = 'rnbqkbnr';
  for (let i = 0; i < 8; i++) {
    board[i] = back[i]!;
    board[8 + i] = 'p';
    board[48 + i] = 'P';
    board[56 + i] = back[i]!.toUpperCase();
  }
  return board;
}

function parseMoves(moves: string): Ply[] {
  return moves
    .split(' ')
    .filter(Boolean)
    .map(token => {
      const [san, squares] = token.split('/');
      const promo = san!.match(/=([QRBN])/)?.[1] ?? null;
      return {
        san: san!,
        from: squareIndex(squares!.slice(0, 2)),
        to: squareIndex(squares!.slice(2, 4)),
        promo,
      };
    });
}

function applyPly(board: string[], ply: Ply) {
  const next = board.slice();
  const piece = next[ply.from]!;
  const isPawn = piece.toUpperCase() === 'P';
  const white = piece === piece.toUpperCase();

  next[ply.from] = '.';
  next[ply.to] = ply.promo ? (white ? ply.promo : ply.promo.toLowerCase()) : piece;

  // En passant: a pawn changed file onto an empty square, so the captured pawn
  // sits beside the origin square rather than on the destination.
  if (isPawn && ply.from % 8 !== ply.to % 8 && board[ply.to] === '.') {
    next[Math.floor(ply.from / 8) * 8 + (ply.to % 8)] = '.';
  }

  // Castling: the king moved two files, so the rook jumps over it.
  if (piece.toUpperCase() === 'K' && Math.abs((ply.from % 8) - (ply.to % 8)) === 2) {
    const rank = Math.floor(ply.to / 8) * 8;
    const kingside = ply.to % 8 === 6;
    next[rank + (kingside ? 5 : 3)] = next[rank + (kingside ? 7 : 0)]!;
    next[rank + (kingside ? 7 : 0)] = '.';
  }

  return next;
}

function buildPositions(plies: Ply[]) {
  const positions = [startingBoard()];
  for (const ply of plies) {
    positions.push(applyPly(positions[positions.length - 1]!, ply));
  }
  return positions;
}

/** Material balance, positive means white is up. Stands in for an engine eval. */
function materialBalance(board: string[]) {
  return board.reduce((total, piece) => {
    if (piece === '.') {
      return total;
    }
    const value = PIECE_VALUE[piece.toLowerCase()] ?? 0;
    return piece === piece.toUpperCase() ? total + value : total - value;
  }, 0);
}

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function ChessBoard({
  board,
  lastPly,
  flipped,
}: {
  board: string[];
  flipped: boolean;
  lastPly: Ply | undefined;
}) {
  const order = useMemo(() => {
    const indexes = Array.from({length: 64}, (_, i) => i);
    return flipped ? indexes.reverse() : indexes;
  }, [flipped]);

  return (
    <BoardGrid>
      {order.map(index => {
        const file = index % 8;
        const rank = Math.floor(index / 8);
        const piece = board[index]!;
        const isDark = (file + rank) % 2 === 1;
        const highlight =
          lastPly && (lastPly.from === index || lastPly.to === index) ? 'move' : undefined;

        return (
          <Square key={index} isDark={isDark} highlight={highlight}>
            {file === (flipped ? 7 : 0) ? <RankLabel>{8 - rank}</RankLabel> : null}
            {rank === (flipped ? 0 : 7) ? <FileLabel>{FILES[file]}</FileLabel> : null}
            {piece === '.' ? null : (
              <Piece isWhite={piece === piece.toUpperCase()}>{PIECE_GLYPH[piece]}</Piece>
            )}
          </Square>
        );
      })}
    </BoardGrid>
  );
}

function MoveList({
  plies,
  ply,
  blunders,
  onSelect,
}: {
  blunders: number[];
  onSelect: (ply: number) => void;
  plies: Ply[];
  ply: number;
}) {
  const rows = useMemo(() => {
    const out: Array<{black: Ply | undefined; index: number; white: Ply | undefined}> = [];
    for (let i = 0; i < plies.length; i += 2) {
      out.push({index: i, white: plies[i], black: plies[i + 1]});
    }
    return out;
  }, [plies]);

  return (
    <MoveScroller>
      {rows.map(row => (
        <MoveRow key={row.index}>
          <MoveNumber>{row.index / 2 + 1}.</MoveNumber>
          {[row.white, row.black].map((move, offset) =>
            move ? (
              <MoveButton
                key={offset}
                isCurrent={ply === row.index + offset + 1}
                isBlunder={blunders.includes(row.index + offset)}
                onClick={() => onSelect(row.index + offset + 1)}
              >
                {move.san}
                {blunders.includes(row.index + offset) ? '??' : ''}
              </MoveButton>
            ) : (
              <span key={offset} />
            )
          )}
        </MoveRow>
      ))}
    </MoveScroller>
  );
}

export default function ChessReplayDetail() {
  const organization = useOrganization();
  const {replaySlug} = useParams<{replaySlug: string}>();
  const game: ChessGame = findGame(replaySlug ?? '') ?? CHESS_GAMES[0]!;

  const plies = useMemo(() => parseMoves(game.moves), [game.moves]);
  const positions = useMemo(() => buildPositions(plies), [plies]);

  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [flipped, setFlipped] = useState(false);

  // Reset when navigating between games.
  useEffect(() => {
    setPly(0);
    setPlaying(false);
  }, [game.id]);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setPly(current => {
        if (current >= plies.length) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, BASE_MS_PER_PLY / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, plies.length]);

  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      setPly(current => Math.max(0, Math.min(plies.length, current + delta)));
    },
    [plies.length]
  );

  const togglePlay = useCallback(() => {
    setPlaying(current => {
      if (!current && ply >= plies.length) {
        setPly(0);
      }
      return !current;
    });
  }, [ply, plies.length]);

  const board = positions[ply]!;
  const lastPly = ply > 0 ? plies[ply - 1] : undefined;
  const balance = materialBalance(board);
  const elapsed = plies.length ? (game.duration * ply) / plies.length : 0;

  const title = `${game.white} vs ${game.black} — Game Replay — ${organization.slug}`;

  return (
    <SentryDocumentTitle title={title}>
      <Stack flex={1} height="100%" minHeight="0" width="100%" overflow="auto">
        <Flex
          justify="between"
          align="center"
          gap="md"
          wrap="wrap"
          padding="md xl"
          borderBottom="secondary"
        >
          <Stack gap="xs">
            <Flex gap="sm" align="center">
              <Link to={`/organizations/${organization.slug}/explore/replays/`}>
                <Text size="sm" variant="muted">
                  {t('Replays')}
                </Text>
              </Link>
              <Text size="sm" variant="muted">
                /
              </Text>
              <Text size="md" bold>
                {game.white} vs {game.black}
              </Text>
            </Flex>
            <Text size="sm" variant="muted">
              {game.opening} ({game.eco}) · {game.timeControl} · {t('room')}{' '}
              {game.roomCode}
            </Text>
          </Stack>
          <Flex gap="lg" align="center">
            <Stat label={t('Result')} value={game.result} />
            <Stat label={t('Moves')} value={String(Math.ceil(plies.length / 2))} />
            <Stat label={t('Blunders')} value={String(game.blunders.length)} />
            <Stat label={t('Duration')} value={formatClock(game.duration)} />
          </Flex>
        </Flex>

        <Grid columns={{xs: '1fr', md: 'minmax(0, 1fr) 320px'}} gap="xl" padding="xl">
          <Panel>
            <PanelHeader>
              <Flex justify="between" align="center" width="100%">
                <span>{t('Board')}</span>
                <Button size="xs" onClick={() => setFlipped(f => !f)}>
                  {t('Flip board')}
                </Button>
              </Flex>
            </PanelHeader>
            <PanelBody>
              <Flex direction="column" align="center" gap="md" padding="lg">
                <BoardRow>
                  <EvalBar
                    aria-label={t('Material balance')}
                    whiteShare={Math.max(
                      4,
                      Math.min(96, 50 + (balance * 100) / 20)
                    )}
                  />
                  <BoardFrame>
                    <ChessBoard board={board} lastPly={lastPly} flipped={flipped} />
                  </BoardFrame>
                </BoardRow>

                <Flex direction="column" gap="sm" width="100%" maxWidth="640px">
                  <Flex justify="between" align="center">
                    <Text size="sm" variant="muted" monospace>
                      {lastPly
                        ? `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '...'} ${lastPly.san}`
                        : t('Starting position')}
                    </Text>
                    <Text size="sm" variant="muted" monospace tabular>
                      {formatClock(elapsed)} / {formatClock(game.duration)}
                    </Text>
                  </Flex>

                  <Slider
                    aria-label={t('Scrub through moves')}
                    min={0}
                    max={plies.length}
                    step={1}
                    value={ply}
                    formatOptions="hidden"
                    onChange={value => {
                      setPlaying(false);
                      setPly(value);
                    }}
                  />

                  <Flex justify="between" align="center" gap="md" wrap="wrap">
                    <ButtonBar>
                      <Button
                        size="sm"
                        aria-label={t('Restart')}
                        icon={<IconRefresh />}
                        onClick={() => step(-plies.length)}
                      />
                      <Button
                        size="sm"
                        aria-label={t('Previous move')}
                        icon={<IconPrevious />}
                        onClick={() => step(-1)}
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        aria-label={playing ? t('Pause') : t('Play')}
                        icon={playing ? <IconPause /> : <IconPlay />}
                        onClick={togglePlay}
                      />
                      <Button
                        size="sm"
                        aria-label={t('Next move')}
                        icon={<IconNext />}
                        onClick={() => step(1)}
                      />
                    </ButtonBar>

                    <ButtonBar>
                      {SPEEDS.map(option => (
                        <Button
                          key={option}
                          size="sm"
                          variant={speed === option ? 'primary' : 'secondary'}
                          onClick={() => setSpeed(option)}
                        >
                          {option}x
                        </Button>
                      ))}
                    </ButtonBar>
                  </Flex>
                </Flex>
              </Flex>
            </PanelBody>
          </Panel>

          <Stack gap="xl">
            <Panel>
              <PanelHeader>{t('Moves')}</PanelHeader>
              <PanelBody>
                <MoveList
                  plies={plies}
                  ply={ply}
                  blunders={game.blunders}
                  onSelect={value => {
                    setPlaying(false);
                    setPly(value);
                  }}
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader>{t('Game')}</PanelHeader>
              <PanelBody>
                <Stack gap="md" padding="lg">
                  <Detail label={t('White')} value={game.white} />
                  <Detail label={t('Black')} value={game.black} />
                  <Detail label={t('Opening')} value={`${game.opening} (${game.eco})`} />
                  <Detail label={t('Time control')} value={game.timeControl} />
                  <Detail label={t('Termination')} value={game.termination} />
                  <Detail
                    label={t('Material')}
                    value={
                      balance === 0
                        ? t('Even')
                        : `${balance > 0 ? game.white : game.black} +${Math.abs(balance)}`
                    }
                  />
                  <Tooltip title={t('The room this game was played in')}>
                    <Detail label={t('Room')} value={game.roomCode} />
                  </Tooltip>
                </Stack>
              </PanelBody>
            </Panel>
          </Stack>
        </Grid>
      </Stack>
    </SentryDocumentTitle>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <Stack gap="0">
      <Text size="xs" variant="muted" uppercase>
        {label}
      </Text>
      <Text size="md" bold tabular>
        {value}
      </Text>
    </Stack>
  );
}

function Detail({label, value}: {label: string; value: string}) {
  return (
    <Flex justify="between" gap="md">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <Text size="sm" align="right">
        {value}
      </Text>
    </Flex>
  );
}

const BoardRow = styled('div')`
  display: flex;
  align-items: stretch;
  gap: ${p => p.theme.space.md};
  width: 100%;
  max-width: 640px;
`;

const EvalBar = styled('div')<{whiteShare: number}>`
  width: 12px;
  flex: none;
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  background: linear-gradient(
    to top,
    ${p => p.theme.tokens.graphics.neutral.vibrant} ${p => p.whiteShare}%,
    ${p => p.theme.tokens.background.secondary} ${p => p.whiteShare}%
  );
  transition: background 200ms ease-out;
`;

const BoardFrame = styled('div')`
  flex: 1;
  min-width: 0;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const BoardGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  aspect-ratio: 1;
  width: 100%;
`;

const Square = styled('div')<{isDark: boolean; highlight?: 'move'}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p =>
    p.isDark
      ? p.theme.tokens.graphics.accent.muted
      : p.theme.tokens.background.secondary};
  box-shadow: ${p =>
    p.highlight === 'move'
      ? `inset 0 0 0 3px ${p.theme.tokens.border.warning.vibrant}`
      : 'none'};
`;

const Piece = styled('span')<{isWhite: boolean}>`
  font-size: clamp(18px, 5.5cqw, 44px);
  line-height: 1;
  user-select: none;
  color: ${p =>
    p.isWhite ? p.theme.tokens.content.onVibrant.light : p.theme.tokens.content.onVibrant.dark};
  text-shadow: ${p =>
    p.isWhite
      ? '0 0 1px #000, 0 0 2px rgba(0, 0, 0, 0.55)'
      : '0 0 1px rgba(255, 255, 255, 0.5)'};
`;

const RankLabel = styled('span')`
  position: absolute;
  top: 2px;
  left: 3px;
  font-size: 9px;
  color: ${p => p.theme.tokens.content.secondary};
`;

const FileLabel = styled('span')`
  position: absolute;
  bottom: 1px;
  right: 3px;
  font-size: 9px;
  color: ${p => p.theme.tokens.content.secondary};
`;

const MoveScroller = styled('div')`
  max-height: 420px;
  overflow-y: auto;
  padding: ${p => p.theme.space.sm};
`;

const MoveRow = styled('div')`
  display: grid;
  grid-template-columns: 32px 1fr 1fr;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const MoveNumber = styled('span')`
  font-variant-numeric: tabular-nums;
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  text-align: right;
`;

const MoveButton = styled('button')<{isBlunder: boolean; isCurrent: boolean}>`
  appearance: none;
  border: 0;
  text-align: left;
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};
  cursor: pointer;
  color: ${p =>
    p.isBlunder ? p.theme.tokens.content.danger : p.theme.tokens.content.primary};
  background: ${p =>
    p.isCurrent
      ? p.theme.tokens.background.transparent.accent.muted
      : 'transparent'};
  font-weight: ${p => (p.isCurrent ? 600 : 400)};

  &:hover {
    background: ${p => p.theme.tokens.background.transparent.neutral.muted};
  }
`;
