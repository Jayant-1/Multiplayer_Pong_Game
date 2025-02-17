const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

const connections = new Map();
let waitingPlayer = null;
let games = new Map();

io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

  // Handle new player connection
  if (waitingPlayer) {
    // Start game with waiting player
    const gameId = `${waitingPlayer.id}-${socket.id}`;
    games.set(gameId, {
      player1: waitingPlayer.id,
      player2: socket.id,
      scores: { p1: 0, p2: 0 },
    });

    connections.set(socket.id, { number: 2, gameId });
    connections.set(waitingPlayer.id, { number: 1, gameId });

    socket.join(gameId);
    waitingPlayer.join(gameId);

    // Send player numbers to both players
    socket.emit("player-number", 2);
    waitingPlayer.emit("player-number", 1);

    // Important: Changed to match client event name
    io.to(gameId).emit("game-start");

    waitingPlayer = null;
  } else {
    // Wait for another player
    connections.set(socket.id, { number: 1 });
    socket.emit("player-number", 1);
    waitingPlayer = socket;
  }

  // Handle player movement
  socket.on("player-move", (position) => {
    const connection = connections.get(socket.id);
    if (connection && connection.gameId) {
      socket.to(connection.gameId).emit("opponent-move", position);
    }
  });

  // Handle ball updates (from host/player 1)
  socket.on("ball-update", (ballData) => {
    const connection = connections.get(socket.id);
    if (connection && connection.gameId) {
      socket.to(connection.gameId).emit("ball-update", ballData);
    }
  });

  // Handle score updates
  socket.on("score-update", (scores) => {
    const connection = connections.get(socket.id);
    if (connection && connection.gameId) {
      const game = games.get(connection.gameId);
      if (game) {
        game.scores = scores;
        io.to(connection.gameId).emit("score-update", scores);
      }
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
    const connection = connections.get(socket.id);

    if (connection) {
      if (socket === waitingPlayer) {
        waitingPlayer = null;
      } else if (connection.gameId) {
        socket.to(connection.gameId).emit("opponent-disconnected");
        games.delete(connection.gameId);
      }
      connections.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to play the game`);
});
