import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Slider} from '@sentry/scraps/slider';
import {Tag} from '@sentry/scraps/badge';
import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconNext} from 'sentry/icons/iconNext';
import {IconPause} from 'sentry/icons/iconPause';
import {IconPlay} from 'sentry/icons/iconPlay';
import {IconPrevious} from 'sentry/icons/iconPrevious';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {
  BoardSquares,
  SquareHighlight,
} from 'sentry/chessMode/components/chessBoard';
import {
  applyMove,
  BoardFrame,
  BoardRow,
  ChessBoard,
  EvalBar,
  materialBalance,
  squareIndex,
  startingBoard,
} from 'sentry/chessMode/components/chessBoard';
import type {ChessGame, MoveSeverity} from 'sentry/chessMode/domains/replays';
import {
  CHESS_GAMES,
  findGame,
  ratingDelta,
  SEVERITY_SUFFIX,
  severityOf,
  toPgn,
} from 'sentry/chessMode/domains/replays';
import {TopBar} from 'sentry/views/navigation/topBar';

/**
 * The Session Replay detail page, but the "session" is a chess game.
 *
 * Rather than feeding rrweb a synthetic recording, this component takes over
 * the `:replaySlug` route and plays the game back on a board. Move data is
 * hardcoded in `chessMode/domains/replays` as verified `SAN/fromto` pairs, so
 * the only logic here is applying a move to a board array.
 */

const SPEEDS = ['0.5', '1', '2', '4'] as const;
const BASE_MS_PER_PLY = 900;

type Ply = {
  from: number;
  promo: string | null;
  san: string;
  to: number;
};

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

function buildPositions(plies: Ply[]): BoardSquares[] {
  const positions = [startingBoard()];
  for (const ply of plies) {
    const previous = positions[positions.length - 1]!;
    positions.push(applyMove(previous, ply.from, ply.to, ply.promo));
  }
  return positions;
}

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function moveLabel(ply: number, san: string) {
  return `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '...'} ${san}`;
}

/**
 * Sentry Replay marks errors on its timeline; this marks the annotated moves,
 * which is the same information in chess clothing.
 */
function ScrubberMarkers({
  game,
  plies,
  onSelect,
}: {
  game: ChessGame;
  onSelect: (ply: number) => void;
  plies: Ply[];
}) {
  const marks = useMemo(
    () =>
      plies
        .map((ply, index) => ({ply, index, severity: severityOf(game, index)}))
        .filter(mark => mark.severity),
    [game, plies]
  );

  return (
    <MarkerRail>
      {marks.map(mark => (
        <Tooltip
          key={mark.index}
          title={`${moveLabel(mark.index + 1, mark.ply.san)}${
            SEVERITY_SUFFIX[mark.severity!]
          } — ${mark.severity}`}
          skipWrapper
        >
          <Marker
            severity={mark.severity!}
            style={{left: `${((mark.index + 1) / plies.length) * 100}%`}}
            onClick={() => onSelect(mark.index + 1)}
            aria-label={moveLabel(mark.index + 1, mark.ply.san)}
          />
        </Tooltip>
      ))}
    </MarkerRail>
  );
}

// -- panels ------------------------------------------------------------------

function MoveList({
  game,
  plies,
  ply,
  onSelect,
}: {
  game: ChessGame;
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
          {[row.white, row.black].map((move, offset) => {
            if (!move) {
              return <span key={offset} />;
            }
            const moveIndex = row.index + offset;
            const severity = severityOf(game, moveIndex);
            return (
              <MoveButton
                key={offset}
                isCurrent={ply === moveIndex + 1}
                onClick={() => onSelect(moveIndex + 1)}
              >
                <MoveSan>{move.san}</MoveSan>
                {severity ? (
                  <Annotation severity={severity} title={severity}>
                    {SEVERITY_SUFFIX[severity]}
                  </Annotation>
                ) : null}
              </MoveButton>
            );
          })}
        </MoveRow>
      ))}
    </MoveScroller>
  );
}

/**
 * Sentry Replay's Console tab, except the process writing to it is an engine.
 * Lines are derived from the real move list so they track the board.
 */
function EngineConsole({game, plies, ply}: {game: ChessGame; plies: Ply[]; ply: number}) {
  const lines = useMemo(() => {
    const out: Array<{level: 'info' | 'warning' | 'error'; text: string}> = [];
    for (let i = 0; i < ply; i++) {
      const move = plies[i]!;
      const severity = severityOf(game, i);
      const depth = 18 + (i % 5);
      const score = (i % 2 === 0 ? 1 : -1) * (12 + ((i * 37) % 180));
      out.push({
        level: 'info',
        text: `info depth ${depth} seldepth ${depth + 6} score cp ${score} pv ${move.san}`,
      });
      if (severity === 'blunder') {
        out.push({level: 'error', text: `eval dropped after ${move.san} — blunder`});
      } else if (severity === 'mistake') {
        out.push({level: 'warning', text: `better was available instead of ${move.san}`});
      }
    }
    return out.slice(-40).reverse();
  }, [game, plies, ply]);

  if (!lines.length) {
    return (
      <ConsoleScroller>
        <ConsoleLine level="info">{t('Waiting for the engine…')}</ConsoleLine>
      </ConsoleScroller>
    );
  }

  return (
    <ConsoleScroller>
      {lines.map((line, index) => (
        <ConsoleLine key={index} level={line.level}>
          {line.text}
        </ConsoleLine>
      ))}
    </ConsoleScroller>
  );
}

function Detail({label, value}: {label: string; value: React.ReactNode}) {
  return (
    <Flex justify="between" gap="lg" align="start">
      <DetailLabel>{label}</DetailLabel>
      <DetailValue>{value}</DetailValue>
    </Flex>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
}) {
  return (
    <Stack gap="0">
      <Text size="xs" variant="muted" uppercase>
        {label}
      </Text>
      <Text size="md" bold tabular variant={tone ?? 'primary'}>
        {value}
      </Text>
    </Stack>
  );
}

// -- page --------------------------------------------------------------------

export default function ChessReplayDetail() {
  const organization = useOrganization();
  const {replaySlug} = useParams<{replaySlug: string}>();
  const game = findGame(replaySlug ?? '') ?? CHESS_GAMES[0]!;

  const plies = useMemo(() => parseMoves(game.moves), [game.moves]);
  const positions = useMemo(() => buildPositions(plies), [plies]);

  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<string>('1');
  const [flipped, setFlipped] = useState(false);
  const {copy} = useCopyToClipboard();

  // Reset when navigating between games.
  useEffect(() => {
    setPly(0);
    setPlaying(false);
  }, [game.id]);

  useEffect(() => {
    if (!playing) {
      return () => {};
    }
    const timer = window.setInterval(() => {
      setPly(current => {
        if (current >= plies.length) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, BASE_MS_PER_PLY / Number(speed));
    return () => window.clearInterval(timer);
  }, [playing, speed, plies.length]);

  function seek(next: number) {
    setPlaying(false);
    setPly(Math.max(0, Math.min(plies.length, next)));
  }

  function step(delta: number) {
    setPlaying(false);
    setPly(current => Math.max(0, Math.min(plies.length, current + delta)));
  }

  function togglePlay() {
    setPlaying(current => {
      if (!current && ply >= plies.length) {
        setPly(0);
      }
      return !current;
    });
  }

  const board = positions[ply]!;
  const lastPly = ply > 0 ? plies[ply - 1] : undefined;
  const lastPlySeverity = ply > 0 ? severityOf(game, ply - 1) : undefined;
  const balance = materialBalance(board);
  // The two squares the last move touched, tinted red when it was annotated.
  const highlights: Record<number, SquareHighlight> = lastPly
    ? {
        [lastPly.from]: lastPlySeverity ? 'bad' : 'move',
        [lastPly.to]: lastPlySeverity ? 'bad' : 'move',
      }
    : {};
  const elapsed = plies.length ? (game.duration * ply) / plies.length : 0;
  const startedAt = new Date(Date.now() - game.startedMinutesAgo * 60_000);

  const whiteWon = game.result === '1-0';
  const heroDelta = ratingDelta(game, whiteWon);
  const heroAccuracy = whiteWon ? game.whiteAccuracy : game.blackAccuracy;

  const title = `${game.white} vs ${game.black} — Game Replay — ${organization.slug}`;
  const matchup = `${game.white} vs ${game.black}`;

  return (
    <SentryDocumentTitle title={title}>
      {/*
        One breadcrumb system only — this feeds the shell's own title slot
        rather than drawing a second crumb trail inside the page body.
      */}
      <TopBar.Slot name="title">
        <Flex align="center" gap="xs">
          <BreadcrumbList
            items={[
              {
                type: 'link',
                label: t('Game Replays'),
                to: `/organizations/${organization.slug}/explore/replays/`,
              },
            ]}
          />
          <BreadcrumbList.Title item={{type: 'page-title', label: matchup}} />
        </Flex>
      </TopBar.Slot>

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
              <Text size="lg" bold>
                {matchup}
              </Text>
              <Tag variant={game.rated ? 'info' : 'muted'}>
                {game.rated ? t('Rated') : t('Casual')}
              </Tag>
            </Flex>
            <Text size="sm" variant="muted">
              {game.opening} ({game.eco}) · {game.timeControl} · {t('room')}{' '}
              {game.roomCode}
            </Text>
          </Stack>
          <Flex gap="lg" align="center" wrap="wrap">
            <Stat label={t('Result')} value={game.result} />
            <Stat label={t('Moves')} value={String(Math.ceil(plies.length / 2))} />
            <Stat
              label={t('Blunders')}
              value={String(game.blunders.length)}
              tone={game.blunders.length ? 'danger' : undefined}
            />
            <Stat label={t('Accuracy')} value={`${heroAccuracy}%`} />
            <Stat
              label={t('Rating')}
              value={`${heroDelta > 0 ? '+' : ''}${heroDelta}`}
              tone={heroDelta >= 0 ? 'success' : 'danger'}
            />
            <Stat label={t('Duration')} value={formatClock(game.duration)} />
            <Button
              size="sm"
              icon={<IconCopy />}
              onClick={() => copy(toPgn(game))}
              aria-label={t('Copy PGN')}
            >
              {t('Copy PGN')}
            </Button>
          </Flex>
        </Flex>

        <Grid columns={{xs: '1fr', md: 'minmax(0, 1fr) 340px'}} gap="xl" padding="xl">
          <Stack gap="xl" minWidth="0">
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
              <Stack align="center" gap="md" padding="lg">
                <BoardRow>
                  <EvalBar balance={balance} />
                  <BoardFrame>
                    <ChessBoard board={board} highlights={highlights} flipped={flipped} />
                  </BoardFrame>
                </BoardRow>

                <Stack gap="xs" width="100%" maxWidth="520px">
                  <ScrubberStack>
                    <Slider
                      aria-label={t('Scrub through moves')}
                      min={0}
                      max={plies.length}
                      step={1}
                      value={ply}
                      formatOptions="hidden"
                      onChange={seek}
                    />
                    <ScrubberMarkers game={game} plies={plies} onSelect={seek} />
                  </ScrubberStack>

                  <Flex justify="between" align="center" gap="md" wrap="wrap">
                    <Flex gap="md" align="center">
                      <ButtonBar>
                        <Button
                          size="sm"
                          variant="transparent"
                          aria-label={t('Restart')}
                          icon={<IconRefresh />}
                          onClick={() => seek(0)}
                        />
                        <Button
                          size="sm"
                          variant="transparent"
                          aria-label={t('Previous move')}
                          icon={<IconPrevious />}
                          onClick={() => step(-1)}
                        />
                        <Button
                          size="sm"
                          variant="transparent"
                          aria-label={playing ? t('Pause') : t('Play')}
                          icon={playing ? <IconPause /> : <IconPlay />}
                          onClick={togglePlay}
                        />
                        <Button
                          size="sm"
                          variant="transparent"
                          aria-label={t('Next move')}
                          icon={<IconNext />}
                          onClick={() => step(1)}
                        />
                      </ButtonBar>
                      <Text size="sm" variant="muted" monospace tabular>
                        {formatClock(elapsed)} / {formatClock(game.duration)}
                      </Text>
                    </Flex>

                    <SegmentedControl
                      size="sm"
                      value={speed}
                      aria-label={t('Playback speed')}
                      onChange={setSpeed}
                    >
                      {SPEEDS.map(option => (
                        <SegmentedControl.Item key={option}>
                          {`${option}x`}
                        </SegmentedControl.Item>
                      ))}
                    </SegmentedControl>
                  </Flex>

                  <Text size="sm" variant="muted" monospace>
                    {lastPly ? moveLabel(ply, lastPly.san) : t('Starting position')}
                  </Text>
                </Stack>
              </Stack>
            </PanelBody>
          </Panel>

            <Panel>
              <PanelHeader>{t('Console')}</PanelHeader>
              <PanelBody>
                <EngineConsole game={game} plies={plies} ply={ply} />
              </PanelBody>
            </Panel>
          </Stack>

          <Stack gap="xl">
            <Panel>
              <PanelHeader>{t('Moves')}</PanelHeader>
              <PanelBody>
                <MoveList game={game} plies={plies} ply={ply} onSelect={seek} />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader>{t('Game')}</PanelHeader>
              <PanelBody>
                <Stack gap="md" padding="lg">
                  <Detail
                    label={t('White')}
                    value={
                      <Fragment>
                        {game.white} · {game.whiteRating}{' '}
                        <Delta isUp={ratingDelta(game, true) >= 0}>
                          {ratingDelta(game, true) > 0 ? '+' : ''}
                          {ratingDelta(game, true)}
                        </Delta>
                      </Fragment>
                    }
                  />
                  <Detail
                    label={t('Black')}
                    value={
                      <Fragment>
                        {game.black} · {game.blackRating}{' '}
                        <Delta isUp={ratingDelta(game, false) >= 0}>
                          {ratingDelta(game, false) > 0 ? '+' : ''}
                          {ratingDelta(game, false)}
                        </Delta>
                      </Fragment>
                    }
                  />
                  <Detail
                    label={t('Accuracy')}
                    value={`${game.whiteAccuracy}% / ${game.blackAccuracy}%`}
                  />
                  <Detail label={t('Opening')} value={game.opening} />
                  <Detail label={t('ECO')} value={game.eco} />
                  <Detail
                    label={t('Time control')}
                    value={`${game.timeControl} · ${game.result}`}
                  />
                  <Detail label={t('Termination')} value={game.termination} />
                  <Detail label={t('Started')} value={<TimeSince date={startedAt} />} />
                  <Detail label={t('Environment')} value={game.timeControl.toLowerCase()} />
                  <Detail label={t('Client')} value="pawn-patrol.javascript 9.4.1" />
                  <Detail label={t('Room')} value={game.roomCode} />
                </Stack>
              </PanelBody>
            </Panel>

          </Stack>
        </Grid>
      </Stack>
    </SentryDocumentTitle>
  );
}

// -- styles ------------------------------------------------------------------

const ScrubberStack = styled('div')`
  position: relative;
  width: 100%;
`;

/** Sits over the slider rail, matching where the handle travels. */
const MarkerRail = styled('div')`
  position: absolute;
  top: 30px;
  left: 12px;
  right: 12px;
  height: 12px;
  pointer-events: none;
`;

const Marker = styled('button')<{severity: MoveSeverity}>`
  position: absolute;
  top: 0;
  width: 8px;
  height: 8px;
  padding: 0;
  transform: translateX(-50%) rotate(45deg);
  border: 0;
  border-radius: 1px;
  cursor: pointer;
  pointer-events: auto;
  background: ${p =>
    p.severity === 'blunder'
      ? p.theme.tokens.graphics.danger.vibrant
      : p.severity === 'mistake'
        ? p.theme.tokens.graphics.warning.vibrant
        : p.theme.tokens.graphics.neutral.moderate};
`;

const MoveScroller = styled('div')`
  max-height: 360px;
  overflow-y: auto;
  padding: ${p => p.theme.space.sm};
`;

const MoveRow = styled('div')`
  display: grid;
  grid-template-columns: 28px 1fr 1fr;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const MoveNumber = styled('span')`
  font-variant-numeric: tabular-nums;
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  text-align: right;
`;

const MoveButton = styled('button')<{isCurrent: boolean}>`
  display: flex;
  align-items: baseline;
  gap: ${p => p.theme.space.xs};
  appearance: none;
  border: 0;
  border-left: 2px solid
    ${p => (p.isCurrent ? p.theme.tokens.border.accent.vibrant : 'transparent')};
  text-align: left;
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.xs};
  cursor: pointer;
  color: ${p => p.theme.tokens.content.primary};
  background: ${p =>
    p.isCurrent ? p.theme.tokens.background.transparent.accent.muted : 'transparent'};
  font-weight: ${p => (p.isCurrent ? 600 : 400)};

  &:hover {
    background: ${p => p.theme.tokens.background.transparent.neutral.muted};
  }
`;

const MoveSan = styled('span')`
  min-width: 0;
`;

/** Graded like Sentry's error levels: blunder red, mistake orange, inaccuracy yellow. */
const Annotation = styled('span')<{severity: MoveSeverity}>`
  font-size: ${p => p.theme.font.size.sm};
  font-weight: 600;
  color: ${p =>
    p.severity === 'blunder'
      ? p.theme.tokens.content.danger
      : p.severity === 'mistake'
        ? p.theme.tokens.content.warning
        : p.theme.tokens.content.secondary};
`;

const Delta = styled('span')<{isUp: boolean}>`
  font-variant-numeric: tabular-nums;
  color: ${p => (p.isUp ? p.theme.tokens.content.success : p.theme.tokens.content.danger)};
`;

const DetailLabel = styled('span')`
  flex: none;
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const DetailValue = styled('span')`
  max-width: 62%;
  text-align: right;
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.primary};
  overflow-wrap: anywhere;
`;

const ConsoleScroller = styled('div')`
  max-height: 220px;
  overflow-y: auto;
  padding: ${p => p.theme.space.sm};
`;

const ConsoleLine = styled('div')<{level: 'info' | 'warning' | 'error'}>`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  padding: 2px ${p => p.theme.space.sm};
  border-left: 2px solid
    ${p =>
      p.level === 'error'
        ? p.theme.tokens.border.danger.vibrant
        : p.level === 'warning'
          ? p.theme.tokens.border.warning.vibrant
          : 'transparent'};
  color: ${p =>
    p.level === 'error'
      ? p.theme.tokens.content.danger
      : p.level === 'warning'
        ? p.theme.tokens.content.warning
        : p.theme.tokens.content.secondary};
  overflow-wrap: anywhere;
`;
