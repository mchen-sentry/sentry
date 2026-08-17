import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Pawn Patrol — live table connection.
 *
 * Talks to the game server at pawn-patrol.coder.sentry.dev over a WebSocket.
 * This is a sanctioned live-data exception to chess mode's no-network rule: it
 * is a real multiplayer backend, not a stubbed Sentry endpoint, and it never
 * goes through the chessMode API interception layer.
 *
 * The server is authoritative for legality, clocks and results. The client
 * mirrors state and derives the ticking clock locally between broadcasts.
 */

const GAME_HOST = 'pawn-patrol.coder.sentry.dev';
const RECONNECT_DELAY_MS = 1600;

export type PieceColor = 'w' | 'b';
export type Seat = PieceColor | 'spectator';

export interface ClockState {
  b: number;
  running: PieceColor | null;
  /** Epoch ms the running clock was last started, or null when paused. */
  since: number | null;
  w: number;
}

export interface HistoryMove {
  color: PieceColor;
  from: string;
  san: string;
  to: string;
  promotion?: string;
}

export interface TableState {
  clock: ClockState;
  fen: string;
  gameId: string;
  history: HistoryMove[];
  players: {b: string | null; w: string | null};
  result: string | null;
  room: string;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

/**
 * Remaining time for one side, projected to `now`.
 *
 * The server only broadcasts on state changes, so between broadcasts the
 * running side's clock has to be derived from when it started.
 */
export function projectedTime(clock: ClockState, color: PieceColor, now: number): number {
  if (clock.running !== color || clock.since === null) {
    return clock[color];
  }
  return Math.max(0, clock[color] - (now - clock.since));
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface UseChessSocketOptions {
  /** Player display name. */
  name: string;
  /** Room code, or null to stay disconnected. */
  room: string | null;
}

export function useChessSocket({room, name}: UseChessSocketOptions) {
  const [state, setState] = useState<TableState | null>(null);
  const [seat, setSeat] = useState<Seat>('spectator');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);
  // Kept in a ref so the reconnect timer always reads the current identity
  // without re-running the connect effect on every keystroke.
  const identityRef = useRef({room, name});
  identityRef.current = {room, name};
  const flaggedRef = useRef(false);

  const send = useCallback((payload: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!room) {
      setStatus('idle');
      setState(null);
      return;
    }

    let disposed = false;

    const connect = (isRetry: boolean) => {
      if (disposed) {
        return;
      }
      setStatus(isRetry ? 'reconnecting' : 'connecting');

      const {room: currentRoom, name: currentName} = identityRef.current;
      const url =
        `wss://${GAME_HOST}/ws?room=${encodeURIComponent(currentRoom ?? '')}` +
        `&name=${encodeURIComponent(currentName || 'Guest player')}`;

      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        retryRef.current = window.setTimeout(() => connect(true), RECONNECT_DELAY_MS);
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        if (!disposed) {
          setStatus('open');
          setError(null);
        }
      };

      socket.onmessage = event => {
        if (disposed) {
          return;
        }
        let message: any;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (message.type === 'welcome') {
          setSeat(message.role as Seat);
          setState(message.state as TableState);
          flaggedRef.current = false;
          return;
        }
        if (message.type === 'state') {
          setState(message.state as TableState);
          // A fresh position means any earlier flag claim is spent.
          if (!message.state?.result) {
            flaggedRef.current = false;
          }
          return;
        }
        if (message.type === 'error') {
          setError(String(message.message ?? 'Something went wrong.'));
        }
      };

      const scheduleRetry = () => {
        if (disposed) {
          return;
        }
        socketRef.current = null;
        retryRef.current = window.setTimeout(() => connect(true), RECONNECT_DELAY_MS);
      };

      socket.onclose = scheduleRetry;
      socket.onerror = () => socket.close();
    };

    connect(false);

    return () => {
      disposed = true;
      if (retryRef.current !== null) {
        window.clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        // Drop the handler first so teardown doesn't schedule a reconnect.
        socket.onclose = null;
        socket.close();
      }
    };
    // Reconnecting on a name change would drop the seat, so only the room
    // drives the connection; the name is read from the ref at connect time.
  }, [room]);

  const move = useCallback(
    (from: string, to: string, promotion?: string) => {
      send({type: 'move', from, to, ...(promotion ? {promotion} : {})});
    },
    [send]
  );
  const resign = useCallback(() => send({type: 'resign'}), [send]);
  const rematch = useCallback(() => send({type: 'reset'}), [send]);

  /** Claim the win when the opponent's clock runs out. Sent at most once. */
  const claimFlag = useCallback(() => {
    if (flaggedRef.current) {
      return;
    }
    flaggedRef.current = true;
    send({type: 'flag'});
  }, [send]);

  return {
    state,
    seat,
    status,
    error,
    dismissError: useCallback(() => setError(null), []),
    move,
    resign,
    rematch,
    claimFlag,
  };
}

/**
 * A `now` that advances every 250ms while a clock is running, so the displayed
 * time ticks. Frozen when nothing is running, to avoid pointless renders.
 */
export function useTickingNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) {
      setNow(Date.now());
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  return now;
}
