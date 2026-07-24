import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameEngine } from '@paper-safari/game-engine';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// 게임 저장소
const games = new Map<string, GameEngine>();

// REST API 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.post('/api/games', (req, res) => {
  const { playerNames, config } = req.body;
  
  if (!playerNames || playerNames.length < 2 || playerNames.length > 4) {
    return res.status(400).json({ error: 'Invalid number of players' });
  }

  const gameEngine = new GameEngine(playerNames, config);
  const gameId = gameEngine.getState().id;
  games.set(gameId, gameEngine);

  res.json({
    gameId,
    state: gameEngine.getState()
  });
});

app.get('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  const gameEngine = games.get(gameId);

  if (!gameEngine) {
    return res.status(404).json({ error: 'Game not found' });
  }

  res.json(gameEngine.getState());
});

// WebSocket 이벤트
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_game', (gameId: string) => {
    const gameEngine = games.get(gameId);
    if (gameEngine) {
      socket.join(gameId);
      io.to(gameId).emit('game_state', gameEngine.getState());
    }
  });

  socket.on('draw_card', (gameId: string, fromDiscard: boolean) => {
    const gameEngine = games.get(gameId);
    if (gameEngine) {
      const card = gameEngine.drawCard(fromDiscard);
      io.to(gameId).emit('card_drawn', {
        card,
        fromDiscard
      });
    }
  });

  socket.on('swap_card', (gameId: string, data: any) => {
    const gameEngine = games.get(gameId);
    if (gameEngine) {
      const result = gameEngine.swapCard(
        data.playerId,
        data.newCard,
        data.handPosition,
        data.fromDiscard
      );
      
      if (result.success) {
        io.to(gameId).emit('card_swapped', result);
        io.to(gameId).emit('game_state', gameEngine.getState());
      }
    }
  });

  socket.on('end_round', (gameId: string) => {
    const gameEngine = games.get(gameId);
    if (gameEngine) {
      const roundResult = gameEngine.endRound();
      
      io.to(gameId).emit('round_ended', roundResult);

      if (gameEngine.isGameOver()) {
        const winner = gameEngine.getWinner();
        io.to(gameId).emit('game_over', {
          winner: winner?.name,
          winnerTokens: winner?.scoreTokens
        });
      } else {
        // 새 라운드 시작 대기
        io.to(gameId).emit('game_state', gameEngine.getState());
      }
    }
  });

  socket.on('start_new_round', (gameId: string, startingPlayerId: string) => {
    const gameEngine = games.get(gameId);
    if (gameEngine) {
      gameEngine.startNewRound(startingPlayerId);
      io.to(gameId).emit('game_state', gameEngine.getState());
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
