import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { Socket } from 'socket.io';
import {
  handleCreateSession,
  handleGetSession,
  handleJoinSession,
  handleLeaveSession,
  handleDisconnect
} from './routers/sessionRouter';
import { handleStartGame, handleUpdateGame, handleGameStatus } from './routers/gameStateRouter';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

// Health check at root - returns a small HTML page with an inline SVG thumbs-up
app.get('/', (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/html');
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>TypeFight WebSocket Health</title>
  </head>
  <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#071021;color:#fff;font-family:Inter,system-ui,sans-serif;">
    <div style="text-align:center">
      <h1 style="margin:0 0 12px 0;font-size:18px;">TypeFight WebSocket Server — OK</h1>
      <svg width="160" height="160" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="thumbs up">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#4caf50" />
            <stop offset="1" stop-color="#2e7d32" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="64" height="64" rx="8" fill="#071827" />
        <path d="M20 44h-6c-1.1 0-2-0.9-2-2V30c0-1.1 0.9-2 2-2h6v16z" fill="#2f3b45" />
        <path d="M30 20c0-3 2-6 5-6 1.7 0 3.2.9 4 2.2L44 20c1 1.8.4 4.1-1.4 5.1l-8.6 5.2c-0.7 0.4-1.1 1.2-1 2v9.5c0 1.7-1.3 3-3 3H24c-1.7 0-3-1.3-3-3V28c0-5 3-8 9-8z" fill="url(#g)" />
        <circle cx="46" cy="16" r="2.4" fill="#ffd54f" />
      </svg>
    </div>
  </body>
</html>`);
});

app.post('/api/session/create', (req: Request, res: Response) => {
  handleCreateSession(req, res);
});

app.get('/api/session/:code', (req: Request, res: Response) => {
  handleGetSession(req, res);
});

io.on('connection', (socket: Socket) => {
  // attach typed data storage to socket
  (socket as any).data = (socket as any).data || {};
  console.log('Client connected:', socket.id);

  socket.on('join-session', (data: any) => {
    handleJoinSession(socket, io, data);
  });

  socket.on('start-game', (data: any) => {
    console.log(`Received start-game from socket ${socket.id} for session ${data.code} and game ${data.gameName}`);
    handleStartGame(socket, io, data);
  });

  socket.on('update-game', (data: any) => {
    handleUpdateGame(socket, io, data);
  });

  socket.on('game-status', (data: any) => {
    handleGameStatus(socket, io, data);
  });

  socket.on('leave-session', (data: any) => {
    handleLeaveSession(socket, io, data);
  });

  socket.on('disconnect', () => {
    handleDisconnect(socket, io);
  });
});

server.listen(PORT, '0.0.0.0', undefined, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server, io };
