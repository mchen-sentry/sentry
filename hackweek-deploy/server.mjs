/**
 * Pawn Patrol production server: serves the static Sentry-frontend build (dist/)
 * and hosts the live chess table service on /ws. This replaces the old
 * sentry-gambit Next.js server entirely.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import * as Sentry from "@sentry/node";
import { WebSocketServer } from "ws";
import { Chess } from "chess.js";

const port = Number(process.env.PORT) || 8080;
const DIST = process.env.DIST_DIR || join(import.meta.dirname, "dist");

Sentry.init({
  dsn: "https://69f4666f8a913ed118913d18660fe20d@o4511927634296832.ingest.us.sentry.io/4511927685939200",
  integrations: [Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] })],
  enableLogs: true,
  tracesSampleRate: 0,
});

const STARTING_TIME = 10 * 60 * 1000;
const IDLE_ROOM_TTL = 60 * 60 * 1000;
const tables = new Map();

function createTable(id) {
  return {
    id,
    gameId: randomUUID(),
    chess: new Chess(),
    clients: new Set(),
    seats: { w: null, b: null },
    result: null,
    clock: { w: STARTING_TIME, b: STARTING_TIME, running: null, since: null },
    touchedAt: Date.now(),
    finishedIssueSent: false,
  };
}

function serializeTable(table) {
  return {
    room: table.id,
    gameId: table.gameId,
    fen: table.chess.fen(),
    history: table.chess.history({ verbose: true }).map((move) => ({
      from: move.from,
      to: move.to,
      san: move.san,
      color: move.color,
      promotion: move.promotion,
    })),
    players: { w: table.seats.w?.name ?? null, b: table.seats.b?.name ?? null },
    result: table.result,
    clock: table.clock,
  };
}

function send(client, payload) {
  try {
    client.socket.send(JSON.stringify(payload));
  } catch {
    // A close event will remove stale clients.
  }
}

function broadcast(table) {
  const payload = JSON.stringify({ type: "state", state: serializeTable(table) });
  for (const client of table.clients) {
    try {
      client.socket.send(payload);
    } catch {
      // A close event will remove stale clients.
    }
  }
}

function pauseClock(table, now = Date.now()) {
  const running = table.clock.running;
  if (running && table.clock.since !== null) {
    table.clock[running] = Math.max(0, table.clock[running] - (now - table.clock.since));
  }
  table.clock.running = null;
  table.clock.since = null;
}

function resumeClock(table, now = Date.now()) {
  if (!table.result && table.seats.w && table.seats.b) {
    table.clock.running = table.chess.turn();
    table.clock.since = now;
  }
}

function flagIfExpired(table, now = Date.now()) {
  const running = table.clock.running;
  if (!running || table.clock.since === null || table.result) return false;
  const remaining = table.clock[running] - (now - table.clock.since);
  if (remaining > 0) return false;
  table.clock[running] = 0;
  table.clock.running = null;
  table.clock.since = null;
  table.result = `${running === "w" ? "Black" : "White"} wins on time`;
  return true;
}

function setBoardResult(table) {
  if (table.chess.isCheckmate()) {
    table.result = `${table.chess.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  } else if (table.chess.isStalemate()) {
    table.result = "Draw by stalemate";
  } else if (table.chess.isThreefoldRepetition()) {
    table.result = "Draw by repetition";
  } else if (table.chess.isInsufficientMaterial()) {
    table.result = "Draw by insufficient material";
  } else if (table.chess.isDrawByFiftyMoves()) {
    table.result = "Draw by the fifty-move rule";
  } else if (table.chess.isDraw()) {
    table.result = "Draw";
  }
  if (table.result) pauseClock(table);
}

function captureFinishedGame(table) {
  if (!table.result || table.finishedIssueSent) return;
  table.finishedIssueSent = true;
  Sentry.withScope((scope) => {
    scope.setTag("chess.game.id", table.gameId);
    scope.setTag("chess.room.id", table.id);
    scope.setTag("chess.game.result", table.result);
    scope.setContext("chess_game", {
      game_id: table.gameId,
      room_id: table.id,
      result: table.result,
      ply_count: table.chess.history().length,
      final_fen: table.chess.fen(),
    });
    scope.setFingerprint(["chess.game.finished", table.gameId]);
    Sentry.captureMessage(`Pawn Patrol game finished — room ${table.id}`);
  });
}

function logMove(table, acceptedMove) {
  const ply = table.chess.history().length;
  Sentry.logger.info("chess.move.accepted", {
    "chess.room.id": table.id,
    "chess.game.id": table.gameId,
    "chess.move.ply": ply,
    "chess.move.number": Math.ceil(ply / 2),
    "chess.move.color": acceptedMove.color === "w" ? "white" : "black",
    "chess.move.from": acceptedMove.from,
    "chess.move.to": acceptedMove.to,
    "chess.move.san": acceptedMove.san,
    "chess.move.uci": `${acceptedMove.from}${acceptedMove.to}${acceptedMove.promotion ?? ""}`,
    "chess.position.fen_after": table.chess.fen(),
    "chess.clock.remaining_ms": table.clock[acceptedMove.color],
    "chess.game.finished": Boolean(table.result),
    "chess.game.result": table.result ?? "in_progress",
  });
}

function handleTableMessage(table, client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send(client, { type: "error", message: "That message could not be read." });
    return;
  }

  table.touchedAt = Date.now();
  if (message.type === "move") {
    if (table.result || (client.role !== "w" && client.role !== "b")) return;
    if (client.role !== table.chess.turn()) {
      send(client, { type: "error", message: "Wait for your turn." });
      return;
    }
    if (flagIfExpired(table)) {
      captureFinishedGame(table);
      broadcast(table);
      return;
    }
    if (!message.from || !message.to) return;

    const now = Date.now();
    pauseClock(table, now);
    let acceptedMove;
    try {
      acceptedMove = table.chess.move({ from: message.from, to: message.to, promotion: message.promotion || "q" });
    } catch {
      resumeClock(table, now);
      send(client, { type: "error", message: "That move is not legal." });
      return;
    }
    setBoardResult(table);
    if (!table.result) resumeClock(table, now);
    logMove(table, acceptedMove);
    if (table.result) captureFinishedGame(table);
    broadcast(table);
    return;
  }

  if (message.type === "resign") {
    if (table.result || (client.role !== "w" && client.role !== "b")) return;
    table.result = `${client.role === "w" ? "Black" : "White"} wins by resignation`;
    pauseClock(table);
    captureFinishedGame(table);
    broadcast(table);
    return;
  }

  if (message.type === "reset") {
    if (client.role === "spectator") return;
    table.chess.reset();
    table.gameId = randomUUID();
    table.result = null;
    table.finishedIssueSent = false;
    table.clock = { w: STARTING_TIME, b: STARTING_TIME, running: null, since: null };
    resumeClock(table);
    broadcast(table);
    return;
  }

  if (message.type === "flag" && flagIfExpired(table)) {
    captureFinishedGame(table);
    broadcast(table);
  }
}

function joinTable(request, socket) {
  const url = new URL(request.url, "http://localhost");
  const roomId = (url.searchParams.get("room") || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
  if (!roomId) {
    socket.close(1008, "A room code is required");
    return;
  }
  const name = (url.searchParams.get("name") || "Guest player").trim().slice(0, 24) || "Guest player";

  let table = tables.get(roomId);
  if (!table) {
    table = createTable(roomId);
    tables.set(roomId, table);
  }

  const role = !table.seats.w ? "w" : !table.seats.b ? "b" : "spectator";
  const client = { id: randomUUID(), name, role, socket };
  table.clients.add(client);
  if (role === "w" || role === "b") table.seats[role] = client;
  table.touchedAt = Date.now();
  if (!table.clock.running) resumeClock(table);

  socket.on("message", (data, isBinary) => {
    if (!isBinary) handleTableMessage(table, client, data.toString());
  });
  socket.on("close", () => {
    pauseClock(table);
    table.clients.delete(client);
    if (client.role === "w" || client.role === "b") {
      if (table.seats[client.role]?.id === client.id) table.seats[client.role] = null;
    }
    table.touchedAt = Date.now();
    broadcast(table);
  });
  socket.on("error", () => socket.close());

  send(client, { type: "welcome", role, playerId: client.id, state: serializeTable(table) });
  broadcast(table);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, table] of tables) {
    if (table.clients.size === 0 && now - table.touchedAt > IDLE_ROOM_TTL) tables.delete(id);
  }
}, 10 * 60 * 1000).unref();

// ---- static SPA serving ----

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".map": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
};

const indexHtml = readFileSync(join(DIST, "index.html"));

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let filePath = null;

  if (url.pathname.startsWith("/_assets/")) {
    const rel = normalize(url.pathname.slice("/_assets/".length)).replace(/^(\.\.[/\\])+/, "");
    const candidate = join(DIST, rel);
    if (candidate.startsWith(DIST) && existsSync(candidate)) filePath = candidate;
  }

  if (filePath) {
    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" });
    res.end(readFileSync(filePath));
    return;
  }

  // SPA fallback: every route serves the app shell.
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
  res.end(indexHtml);
}

const server = createServer(serveStatic);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => joinTable(req, ws));
  } else {
    socket.destroy();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Pawn Patrol (Sentry edition) listening on http://0.0.0.0:${port}`);
});
