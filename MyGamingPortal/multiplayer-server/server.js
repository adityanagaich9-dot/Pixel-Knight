'use strict';

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 10000);
const TICK_MS = 1000 / 30;
const STATE_MS = 1000 / 20;
const FLOOR_Y = 470;
const PLAYER_W = 30;
const PLAYER_H = 44;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();

const platforms = [
  { x: 265, y: 354, w: 155, h: 14 },
  { x: 520, y: 300, w: 160, h: 14 },
  { x: 735, y: 367, w: 120, h: 14 },
];

function send(ws, packet) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(packet));
}

function roomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makePlayer(id, name) {
  return {
    id, name: String(name || `Knight ${id + 1}`).slice(0, 18),
    x: id === 0 ? 145 : 785, y: FLOOR_Y - PLAYER_H,
    vx: 0, vy: 0, health: 100, score: 0, facing: id === 0 ? 1 : -1,
    onGround: true, input: { left: false, right: false, jump: false, attack: false },
    jumpQueued: false, attackQueued: false, attackCooldown: 0,
    hitFlash: 0, lastJump: false, lastAttack: false,
  };
}

function publicRoomState(room) {
  return {
    type: 'state', code: room.code, players: room.players.map((p) => p ? ({
      id: p.id, name: p.name, x: p.x, y: p.y, health: p.health, score: p.score,
      facing: p.facing, onGround: p.onGround, hitFlash: p.hitFlash,
    }) : null),
    match: room.match,
    winner: room.winner,
    rematchVotes: room.players.filter((p) => p && p.rematch).length,
  };
}

function broadcast(room, packet) {
  for (const p of room.players) if (p && p.ws) send(p.ws, packet);
}

function announceRoom(room) {
  broadcast(room, {
    type: 'room', code: room.code, players: room.players.filter(Boolean).length,
    names: room.players.map((p) => p ? p.name : null), match: room.match,
  });
}

function attachPlayer(room, ws, id, name) {
  const player = makePlayer(id, name);
  player.ws = ws;
  player.rematch = false;
  room.players[id] = player;
  ws.roomCode = room.code;
  ws.playerId = id;
  send(ws, { type: 'joined', code: room.code, playerId: id, state: publicRoomState(room) });
  if (room.players[0] && room.players[1]) {
    room.match = 'playing';
    broadcast(room, { type: 'match_started', code: room.code });
  }
  announceRoom(room);
  broadcast(room, publicRoomState(room));
}

function resetRound(room, resetScore) {
  room.players.forEach((p, id) => {
    if (!p) return;
    const ws = p.ws;
    const name = p.name;
    const score = resetScore ? 0 : p.score;
    const newPlayer = makePlayer(id, name);
    newPlayer.ws = ws;
    newPlayer.score = score;
    newPlayer.rematch = false;
    room.players[id] = newPlayer;
  });
  room.match = room.players[0] && room.players[1] ? 'playing' : 'waiting';
  room.winner = null;
  room.roundEndsAt = 0;
  broadcast(room, { type: 'round_reset', state: publicRoomState(room) });
}

function removeSocket(ws) {
  const code = ws.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  const id = ws.playerId;
  if (Number.isInteger(id) && room.players[id] && room.players[id].ws === ws) {
    room.players[id] = null;
  }
  ws.roomCode = null;
  ws.playerId = null;
  if (!room.players.some(Boolean)) {
    rooms.delete(code);
    return;
  }
  room.match = 'waiting';
  room.winner = null;
  room.players.forEach((p) => {
    if (p) {
      p.input = { left: false, right: false, jump: false, attack: false };
      send(p.ws, { type: 'opponent_left', message: 'Your friend disconnected. Share the room code to invite them back.' });
    }
  });
  announceRoom(room);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function applyInput(p) {
  if (!p) return;
  const axis = Number(Boolean(p.input.right)) - Number(Boolean(p.input.left));
  if (axis) p.facing = axis;
  p.vx = axis * 248;
  if (p.jumpQueued && p.onGround) {
    p.vy = -575;
    p.onGround = false;
  }
  p.jumpQueued = false;
}

function simulatePlayer(p, dt) {
  if (!p) return;
  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  applyInput(p);

  const prevBottom = p.y + PLAYER_H;
  p.vy = Math.min(900, p.vy + 1450 * dt);
  p.x = clamp(p.x + p.vx * dt, 8, 960 - PLAYER_W - 8);
  p.y += p.vy * dt;
  p.onGround = false;

  if (p.y + PLAYER_H >= FLOOR_Y) {
    p.y = FLOOR_Y - PLAYER_H;
    p.vy = 0;
    p.onGround = true;
  }

  // Hand-authored arena ledges: land only while descending onto their top.
  if (p.vy >= 0) {
    for (const plat of platforms) {
      const newBottom = p.y + PLAYER_H;
      const horizontallyOverlapping = p.x + PLAYER_W > plat.x && p.x < plat.x + plat.w;
      if (horizontallyOverlapping && prevBottom <= plat.y && newBottom >= plat.y) {
        p.y = plat.y - PLAYER_H;
        p.vy = 0;
        p.onGround = true;
      }
    }
  }

  if (p.y > 560) {
    p.x = p.id === 0 ? 145 : 785;
    p.y = FLOOR_Y - PLAYER_H;
    p.vx = p.vy = 0;
    p.health = Math.max(1, p.health - 10);
  }
}

function processAttacks(room) {
  const [a, b] = room.players;
  if (!a || !b || room.match !== 'playing') return;
  for (const p of [a, b]) {
    if (!p.attackQueued || p.attackCooldown > 0) {
      p.attackQueued = false;
      continue;
    }
    p.attackQueued = false;
    p.attackCooldown = 0.42;
    const target = p.id === 0 ? b : a;
    const dx = target.x + PLAYER_W / 2 - (p.x + PLAYER_W / 2);
    const dy = Math.abs(target.y - p.y);
    if (dx * p.facing > 0 && Math.abs(dx) <= 96 && dy <= 72 && target.hitFlash <= 0) {
      target.health = Math.max(0, target.health - 18);
      target.hitFlash = 0.18;
      target.vx = p.facing * 325;
      target.vy = -145;
      target.onGround = false;
      if (target.health <= 0) {
        p.score += 1;
        room.match = 'round_over';
        room.winner = p.name;
        room.roundEndsAt = Date.now() + 1800;
        if (p.score >= 5) {
          room.match = 'match_over';
        }
      }
    }
  }
}

function tick() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.match === 'round_over' && room.roundEndsAt && now >= room.roundEndsAt) {
      resetRound(room, false);
      continue;
    }
    if (room.match === 'playing' && room.players[0] && room.players[1]) {
      const dt = Math.min(0.05, TICK_MS / 1000);
      for (const p of room.players) simulatePlayer(p, dt);
      processAttacks(room);
      if (now - room.lastBroadcast >= STATE_MS) {
        room.lastBroadcast = now;
        broadcast(room, publicRoomState(room));
      }
    } else if (now - room.lastBroadcast >= 500) {
      room.lastBroadcast = now;
      broadcast(room, publicRoomState(room));
    }
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/') {
    const body = JSON.stringify({ ok: true, service: 'pixel-knight-room-server', rooms: rooms.size });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { send(ws, { type: 'error', message: 'Invalid message.' }); return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'create') {
      if (ws.roomCode) { send(ws, { type: 'error', message: 'You are already in a room.' }); return; }
      const code = roomCode();
      const room = { code, players: [null, null], match: 'waiting', winner: null, roundEndsAt: 0, lastBroadcast: 0 };
      rooms.set(code, room);
      attachPlayer(room, ws, 0, msg.name);
      return;
    }

    if (msg.type === 'join') {
      if (ws.roomCode) { send(ws, { type: 'error', message: 'Leave your current room first.' }); return; }
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const room = rooms.get(code);
      if (!room) { send(ws, { type: 'error', message: 'Room not found. Check the code and try again.' }); return; }
      if (room.players[1]) { send(ws, { type: 'error', message: 'That room already has two players.' }); return; }
      attachPlayer(room, ws, 1, msg.name);
      return;
    }

    const room = rooms.get(ws.roomCode);
    const player = room && Number.isInteger(ws.playerId) ? room.players[ws.playerId] : null;
    if (!room || !player) { send(ws, { type: 'error', message: 'Join a room first.' }); return; }

    if (msg.type === 'input') {
      if (room.match !== 'playing') return;
      const input = msg.input || {};
      const jump = Boolean(input.jump);
      const attack = Boolean(input.attack);
      if (jump && !player.input.jump) player.jumpQueued = true;
      if (attack && !player.input.attack) player.attackQueued = true;
      player.input = {
        left: Boolean(input.left), right: Boolean(input.right),
        jump, attack,
      };
      return;
    }

    if (msg.type === 'rematch') {
      if (room.match !== 'match_over' && room.match !== 'waiting') return;
      player.rematch = true;
      if (room.players[0] && room.players[1] && room.players.every((p) => p && p.rematch)) {
        resetRound(room, true);
      } else {
        broadcast(room, { type: 'rematch_vote', votes: room.players.filter((p) => p && p.rematch).length });
      }
      return;
    }

    if (msg.type === 'leave') ws.close(1000, 'Player left room');
  });

  ws.on('close', () => removeSocket(ws));
  ws.on('error', () => removeSocket(ws));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);
setInterval(tick, TICK_MS);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pixel Knight room server listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close();
  server.close(() => process.exit(0));
});
