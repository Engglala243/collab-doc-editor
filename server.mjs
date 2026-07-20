/**
 * WebSocket Relay Server — Yjs Sync Protocol (manual implementation)
 *
 * This server relays Yjs sync messages between clients for the same document room.
 * It does NOT store state — REST /sync is the source of truth.
 *
 * Yjs Sync Protocol message types (first byte of binary frame):
 *   0 = sync step 1  (request state vector)
 *   1 = sync step 2  (send state as update)
 *   2 = update       (incremental CRDT update)
 *   Others = awareness, auth, etc.
 *
 * Viewer isolation: VIEWERS can receive relayed updates but cannot send updates
 * (bytes 0 and 2 are dropped). The REST /sync endpoint enforces this server-side.
 */

import { WebSocketServer } from "ws";
import http from "http";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import url from "url";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env manually since this is a standalone Node process (not Next.js)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(path.join(__dirname, ".env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env not found — fine in production */ }

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

// Map<documentId, Set<WebSocket>> — active rooms
const rooms = new Map();

async function checkPermission(documentId, userId) {
  if (!documentId || !userId) return null;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { members: { where: { userId } } },
  });
  if (!doc) return null;
  if (doc.ownerId === userId) return "OWNER";
  return doc.members[0]?.role || null;
}

function joinRoom(documentId, ws) {
  if (!rooms.has(documentId)) rooms.set(documentId, new Set());
  rooms.get(documentId).add(ws);
}

function leaveRoom(documentId, ws) {
  const room = rooms.get(documentId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) rooms.delete(documentId);
}

function broadcast(documentId, data, exclude) {
  const room = rooms.get(documentId);
  if (!room) return;
  for (const client of room) {
    if (client !== exclude && client.readyState === 1 /* OPEN */) {
      client.send(data);
    }
  }
}

wss.on("connection", (ws, req, { documentId, role }) => {
  joinRoom(documentId, ws);
  const connectedCount = rooms.get(documentId)?.size ?? 1;
  console.log(`[WS] ${role} connected to ${documentId} (${connectedCount} total)`);

  ws.on("message", (data) => {
    // VIEWERS cannot send document state updates
    if (role === "VIEWER") {
      // Drop Yjs sync (type 0) and update (type 2) messages
      // Allow awareness (type 1 in the awareness channel) for cursor display
      if (data[0] === 0 || data[0] === 2) {
        return;
      }
    }
    // Relay to everyone else in the room
    broadcast(documentId, data, ws);
  });

  ws.on("close", () => {
    leaveRoom(documentId, ws);
    console.log(`[WS] Client disconnected from ${documentId}`);
  });

  ws.on("error", (err) => {
    console.error(`[WS] Error on ${documentId}:`, err.message);
    leaveRoom(documentId, ws);
  });
});

server.on("upgrade", async (request, socket, head) => {
  const parsedUrl = url.parse(request.url, true);
  const pathname = parsedUrl.pathname;
  const documentId = pathname.substring(1);
  const userId = parsedUrl.query.userId;

  if (!documentId || !userId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const role = await checkPermission(documentId, String(userId));

  if (!role) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, { documentId, role });
  });
});

const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
  console.log(`[WS] Relay Server running on ws://localhost:${PORT}`);
});
