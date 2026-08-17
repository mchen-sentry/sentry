import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {Chess} from 'chess.js';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {PlayBoard} from 'sentry/chessMode/components/playBoard';
import {
  formatClock,
  projectedTime,
  useChessSocket,
  useTickingNow,
  type PieceColor,
  type TableState,
} from 'sentry/chessMode/useChessSocket';
import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

const NAME_STORAGE_KEY = 'pawn-patrol-player-name';
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

function readStoredName(): string {
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeName(name: string) {
  try {
    window.localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // Storage disabled; the name just won't persist.
  }
}

function normalizeRoom(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

export default function PlayView() {
  const location = useLocation();
  const room = normalizeRoom(String(location.query.room ?? ''));

  return (
    <SentryDocumentTitle title={room ? t('Table %s', room) : t('Play')}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Play')}</Layout.Title>
            <Text size="sm" variant="muted">
              {t('Live tables. Games played here appear in the Feed once finished.')}
            </Text>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main width="full">
            {room ? <LiveTable room={room} /> : <Lobby />}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

function Lobby() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const [name, setName] = useState(readStoredName);
  const [joinCode, setJoinCode] = useState('');

  const go = (code: string) => {
    storeName(name.trim());
    navigate({
      pathname: `/organizations/${organization.slug}/play/`,
      query: {room: code},
    });
  };

  const joinDisabled = normalizeRoom(joinCode).length < 4;

  return (
    <Grid
      columns={{'screen:sm': '1fr', 'screen:md': '1fr 1fr'}}
      gap="xl"
      maxWidth="900px"
    >
      <Panel>
        <Stack gap="lg">
          <Heading as="h2" size="lg">
            {t('Take a seat')}
          </Heading>
          <Text size="sm" variant="muted">
            {t(
              'Open a table and share the code. The first two people to arrive get the pieces; everyone after that watches.'
            )}
          </Text>
          <Stack gap="sm">
            <Text size="sm" bold>
              {t('Your name')}
            </Text>
            <Input
              value={name}
              maxLength={24}
              placeholder={t('Magnus Sentry')}
              onChange={e => setName(e.target.value)}
            />
          </Stack>
          <Flex>
            <Button variant="primary" onClick={() => go(generateRoomCode())}>
              {t('Open a table')}
            </Button>
          </Flex>
        </Stack>
      </Panel>

      <Panel>
        <Stack gap="lg">
          <Heading as="h2" size="lg">
            {t('Join a table')}
          </Heading>
          <Text size="sm" variant="muted">
            {t('Got a code from someone? Enter it here.')}
          </Text>
          <Stack gap="sm">
            <Text size="sm" bold>
              {t('Table code')}
            </Text>
            <Input
              value={joinCode}
              placeholder="A4V2EG"
              onChange={e => setJoinCode(normalizeRoom(e.target.value))}
              onKeyDown={e => {
                if (e.key === 'Enter' && !joinDisabled) {
                  go(normalizeRoom(joinCode));
                }
              }}
            />
          </Stack>
          <Flex>
            <Button disabled={joinDisabled} onClick={() => go(normalizeRoom(joinCode))}>
              {t('Join table')}
            </Button>
          </Flex>
        </Stack>
      </Panel>
    </Grid>
  );
}

interface LiveTableProps {
  room: string;
}

function LiveTable({room}: LiveTableProps) {
  const organization = useOrganization();
  const [name] = useState(readStoredName);
  const {state, seat, status, error, dismissError, move, resign, rematch, claimFlag} =
    useChessSocket({room, name});

  const orientation = seat === 'b' ? 'b' : 'w';
  const isPlayer = seat === 'w' || seat === 'b';

  // chess.js mirrors the server position so we can offer legal-move hints,
  // detect check, and know when a move needs a promotion choice. The server
  // stays authoritative — this never decides whether a move is sent.
  const chess = useMemo(() => {
    if (!state?.fen) {
      return null;
    }
    try {
      return new Chess(state.fen);
    } catch {
      return null;
    }
  }, [state?.fen]);

  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const turn = (chess?.turn() ?? 'w');
  const myTurn = isPlayer && seat === turn && !state?.result;

  // Clear any selection when the position changes under us.
  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [state?.fen]);

  const legalTargets = useMemo(() => {
    if (!chess || !selected || !myTurn) {
      return [];
    }
    return chess
      .moves({square: selected as any, verbose: true})
      .map((m: any) => m.to as string);
  }, [chess, selected, myTurn]);

  const handleSelect = useCallback(
    (square: string) => {
      if (!chess || !myTurn) {
        return;
      }

      if (selected) {
        const candidates = chess
          .moves({square: selected as any, verbose: true})
          .filter((m: any) => m.to === square);

        if (candidates.length) {
          // A pawn reaching the last rank has four possible moves to the same
          // square; ask which piece rather than silently queening.
          if (candidates.some((m: any) => m.promotion)) {
            setPendingPromotion({from: selected, to: square});
            return;
          }
          move(selected, square);
          setSelected(null);
          return;
        }
      }

      const piece = chess.get(square as any);
      setSelected(piece?.color === seat ? square : null);
    },
    [chess, myTurn, selected, seat, move]
  );

  const inCheck = Boolean(chess?.inCheck());
  const checkSquare = useMemo(() => {
    if (!chess || !inCheck) {
      return null;
    }
    for (const row of chess.board()) {
      for (const cell of row) {
        if (cell?.type === 'k' && cell.color === turn) {
          return cell.square;
        }
      }
    }
    return null;
  }, [chess, inCheck, turn]);

  const lastMove = state?.history.length
    ? state.history[state.history.length - 1]!
    : null;

  const clockRunning = Boolean(state?.clock.running && !state.result);
  const now = useTickingNow(clockRunning);

  // Claim the win when the opponent flags. The server verifies before acting.
  useEffect(() => {
    if (!state || state.result || !state.clock.running) {
      return;
    }
    if (projectedTime(state.clock, state.clock.running, now) <= 0) {
      claimFlag();
    }
  }, [state, now, claimFlag]);

  const topColor = orientation === 'w' ? 'b' : 'w';
  const bottomColor = orientation;

  return (
    <Stack gap="lg">
      <ConnectionBanner status={status} room={room} />
      {error && (
        <Alert
          variant="warning"
          trailingItems={
            <Button size="xs" variant="transparent" onClick={dismissError}>
              {t('Dismiss')}
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {state?.result && (
        <ResultBanner result={state.result} onRematch={isPlayer ? rematch : undefined} />
      )}

      <Grid
        columns={{'screen:sm': '1fr', 'screen:lg': 'minmax(0, 1fr) 320px'}}
        gap="xl"
        align="start"
      >
        <Stack gap="md" maxWidth="720px">
          <SeatRow
            color={topColor}
            state={state}
            now={now}
            isYou={isPlayer && seat === topColor}
          />
          <PlayBoard
            fen={state?.fen ?? new Chess().fen()}
            orientation={orientation}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={lastMove}
            checkSquare={checkSquare}
            onSelect={handleSelect}
          />
          <SeatRow
            color={bottomColor}
            state={state}
            now={now}
            isYou={isPlayer && seat === bottomColor}
          />
        </Stack>

        <Stack gap="lg">
          <Panel>
            <Stack gap="md">
              <Text size="xs" bold uppercase variant="muted">
                {t('Table')}
              </Text>
              <RoomCode>{room}</RoomCode>
              <InviteLink organization={organization.slug} room={room} />
              <Text size="sm" variant="muted">
                {seat === 'spectator'
                  ? t('Both seats are taken — you are watching.')
                  : seat === 'w'
                    ? t('You are playing White.')
                    : t('You are playing Black.')}
              </Text>
              <TurnLine
                state={state}
                turn={turn}
                myTurn={myTurn}
                inCheck={inCheck}
                isPlayer={isPlayer}
              />
              {isPlayer && !state?.result && (
                <Flex>
                  <Button size="sm" onClick={resign}>
                    {t('Resign')}
                  </Button>
                </Flex>
              )}
            </Stack>
          </Panel>

          <Panel>
            <Stack gap="md">
              <Text size="xs" bold uppercase variant="muted">
                {t('Move sheet')}
              </Text>
              <MoveSheet history={state?.history ?? []} />
            </Stack>
          </Panel>
        </Stack>
      </Grid>

      {pendingPromotion && (
        <PromotionPicker
          color={seat === 'b' ? 'b' : 'w'}
          onCancel={() => setPendingPromotion(null)}
          onPick={piece => {
            move(pendingPromotion.from, pendingPromotion.to, piece);
            setPendingPromotion(null);
            setSelected(null);
          }}
        />
      )}
    </Stack>
  );
}

function ConnectionBanner({status, room}: {room: string; status: string}) {
  if (status === 'open') {
    return null;
  }
  return (
    <Alert variant="info">
      {status === 'reconnecting'
        ? t('Connection lost — reconnecting to table %s…', room)
        : t('Connecting to table %s…', room)}
    </Alert>
  );
}

function ResultBanner({result, onRematch}: {result: string; onRematch?: () => void}) {
  // The post-mortem number is a stub: the real one is filed by the game server
  // when it reports the finished game to Sentry.
  const shortId = `PAWN-MORTEM-${(Math.abs(hashString(result)) % 90) + 10}`;

  return (
    <Alert
      variant="success"
      trailingItems={
        onRematch ? (
          <Button size="xs" variant="primary" onClick={onRematch}>
            {t('Rematch')}
          </Button>
        ) : undefined
      }
    >
      <Flex gap="md" align="center" wrap="wrap">
        <Text bold>{result}</Text>
        <LinkButton size="xs" to="/issues/" variant="transparent">
          {tct('Post-mortem filed: [shortId] →', {shortId})}
        </LinkButton>
      </Flex>
    </Alert>
  );
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.trunc(hash * 31 + value.charCodeAt(i));
  }
  return hash;
}

function TurnLine({
  state,
  turn,
  myTurn,
  inCheck,
  isPlayer,
}: {
  inCheck: boolean;
  isPlayer: boolean;
  myTurn: boolean;
  state: TableState | null;
  turn: PieceColor;
}) {
  if (state?.result) {
    return null;
  }
  if (!state?.players.w || !state.players.b) {
    return (
      <Text size="sm" variant="muted">
        {t('Waiting for an opponent to join…')}
      </Text>
    );
  }

  const side = turn === 'w' ? t('White') : t('Black');

  return (
    <Text size="sm" variant={inCheck ? 'danger' : 'muted'}>
      {inCheck
        ? t('%s is in check.', side)
        : isPlayer && myTurn
          ? t('Your move.')
          : t('%s to move.', side)}
    </Text>
  );
}

function SeatRow({
  color,
  state,
  now,
  isYou,
}: {
  color: PieceColor;
  isYou: boolean;
  now: number;
  state: TableState | null;
}) {
  const player = state?.players[color];
  const active = state?.clock.running === color && !state?.result;
  const ms = state ? projectedTime(state.clock, color, now) : 600_000;

  return (
    <Flex justify="between" align="center" gap="md">
      <Flex gap="sm" align="center">
        <SeatSwatch isWhite={color === 'w'} />
        <Text bold={isYou}>
          {player ?? t('Empty seat')}
          {isYou ? t(' (you)') : ''}
        </Text>
      </Flex>
      <ClockChip isActive={active} isLow={ms < 30_000}>
        {formatClock(ms)}
      </ClockChip>
    </Flex>
  );
}

function MoveSheet({history}: {history: Array<{san: string}>}) {
  if (!history.length) {
    return (
      <Text size="sm" variant="muted">
        {t('No moves yet.')}
      </Text>
    );
  }

  const rows: Array<{number: number; black?: string; white?: string}> = [];
  history.forEach((mv, index) => {
    const moveNumber = Math.floor(index / 2) + 1;
    if (index % 2 === 0) {
      rows.push({number: moveNumber, white: mv.san});
    } else {
      rows[rows.length - 1]!.black = mv.san;
    }
  });

  return (
    <MoveScroll>
      {rows.map(row => (
        <MoveRow key={row.number}>
          <Text size="sm" variant="muted">
            {row.number}.
          </Text>
          <Text size="sm">{row.white ?? ''}</Text>
          <Text size="sm">{row.black ?? ''}</Text>
        </MoveRow>
      ))}
    </MoveScroll>
  );
}

function InviteLink({organization, room}: {organization: string; room: string}) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/organizations/${organization}/play/?room=${room}`;

  return (
    <Button
      size="xs"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          },
          () => setCopied(false)
        );
      }}
    >
      {copied ? t('Invite link copied') : t('Copy invite link')}
    </Button>
  );
}

const PROMOTION_PIECES: Array<{glyph: string; label: string; value: string}> = [
  {value: 'q', glyph: '♛', label: 'Queen'},
  {value: 'r', glyph: '♜', label: 'Rook'},
  {value: 'b', glyph: '♝', label: 'Bishop'},
  {value: 'n', glyph: '♞', label: 'Knight'},
];

function PromotionPicker({
  color,
  onPick,
  onCancel,
}: {
  color: PieceColor;
  onCancel: () => void;
  onPick: (piece: string) => void;
}) {
  return (
    <PromotionBackdrop onClick={onCancel}>
      <PromotionCard onClick={e => e.stopPropagation()}>
        <Stack gap="md">
          <Text bold>{t('Promote to')}</Text>
          <Flex gap="sm">
            {PROMOTION_PIECES.map(piece => (
              <PromotionButton
                key={piece.value}
                isWhite={color === 'w'}
                aria-label={piece.label}
                onClick={() => onPick(piece.value)}
              >
                {piece.glyph}
              </PromotionButton>
            ))}
          </Flex>
        </Stack>
      </PromotionCard>
    </PromotionBackdrop>
  );
}

const Panel = styled(Container)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${p => p.theme.space.xl};
`;

const RoomCode = styled('div')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 4px;
  color: ${p => p.theme.tokens.content.accent};
`;

const SeatSwatch = styled('span')<{isWhite: boolean}>`
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: ${p => (p.isWhite ? '#f4f2f8' : '#17141f')};
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

const ClockChip = styled('div')<{isActive: boolean; isLow: boolean}>`
  font-family: ${p => p.theme.font.family.mono};
  font-size: 20px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: ${p => p.theme.radius.sm};
  color: ${p => (p.isLow ? p.theme.tokens.content.danger : p.theme.tokens.content.primary)};
  background: ${p =>
    p.isActive
      ? p.theme.tokens.background.transparent.accent.muted
      : p.theme.tokens.background.tertiary};
  border: 1px solid
    ${p =>
      p.isActive ? p.theme.tokens.border.accent.vibrant : p.theme.tokens.border.primary};
`;

const MoveScroll = styled('div')`
  max-height: 320px;
  overflow-y: auto;
`;

const MoveRow = styled('div')`
  display: grid;
  grid-template-columns: 32px 1fr 1fr;
  gap: ${p => p.theme.space.sm};
  padding: 2px 0;
`;

const PromotionBackdrop = styled('div')`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
`;

const PromotionCard = styled('div')`
  padding: ${p => p.theme.space.xl};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

const PromotionButton = styled('button')<{isWhite: boolean}>`
  font-size: 40px;
  line-height: 1;
  padding: ${p => p.theme.space.sm};
  cursor: pointer;
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.background.tertiary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  color: ${p =>
    p.isWhite
      ? p.theme.tokens.content.onVibrant.light
      : p.theme.tokens.content.onVibrant.dark};
  -webkit-text-stroke: 1px
    ${p => (p.isWhite ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.85)')};

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
  }
`;
