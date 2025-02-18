// Global Variables and Constants
const DIRECTION = {
  IDLE: 0,
  UP: 1,
  DOWN: 2,
  LEFT: 3,
  RIGHT: 4,
};

const rounds = [5, 5, 3, 3, 2];
const colors = ["#1abc9c", "#2ecc71", "#3498db", "#8c52ff", "#9b59b6"];

// Ball object
const Ball = {
  new: function (incrementedSpeed) {
    return {
      width: 18,
      height: 18,
      x: this.canvas.width / 2 - 9,
      y: this.canvas.height / 2 - 9,
      moveX: DIRECTION.IDLE,
      moveY: DIRECTION.IDLE,
      speed: incrementedSpeed || 5,
    };
  },
};

// Paddle object (for both players)
const Paddle = {
  new: function (side) {
    return {
      width: 18,
      height: 180,
      x: side === "left" ? 150 : this.canvas.width - 150,
      y: this.canvas.height / 2 - 35,
      score: 0,
      move: DIRECTION.IDLE,
      speed: 8,
    };
  },
};

const Game = {
  initialize: function () {
    this.canvas = document.querySelector("canvas");
    this.context = this.canvas.getContext("2d");

    this.canvas.width = 1400;
    this.canvas.height = 1000;

    this.canvas.style.width = this.canvas.width / 2 + "px";
    this.canvas.style.height = this.canvas.height / 2 + "px";

    // Initialize socket connection
    this.socket = io("http://192.168.30.192:3000");  // Replace with your server's LAN IP
    this.setupSocketListeners();

    // Initialize game state
    this.player = Paddle.new.call(this, "left");
    this.opponent = Paddle.new.call(this, "right");
    this.ball = Ball.new.call(this);

    this.running = false;
    this.over = false;
    this.waiting = true;
    this.playerNumber = null;
    this.round = 0;
    this.color = "#8c52ff";
    this.timer = 0;

    // Load and setup audio
    this.loadAudio();

    // Set dark mode as default
    document.body.classList.add("dark-mode");

    this.listen();
    this.showWaitingScreen("Connecting to server...");
  },

  loadAudio: function () {
    this.hitSound = new Audio("../audio/hit.mp3");
    this.hitSound1 = new Audio("../audio/hit.mp3");
    this.scoreSound = new Audio("../audio/score.mp3");
    this.winSound = new Audio("../audio/win.mp3");
    this.loseSound = new Audio("../audio/lose.mp3");
    this.backgroundMusic = new Audio("../audio/background_music.mp3");
    this.backgroundMusic.loop = true;
  },

  setupSocketListeners: function () {
    this.socket.on("player-number", (num) => {
      console.log("Received player number:", num);
      this.playerNumber = num;
      if (num === 1) {
        this.showWaitingScreen("Waiting for opponent...");
      } else {
        this.showWaitingScreen("Joining game...");
      }
    });

    this.socket.on("game-start", () => {
      console.log("Game starting...");
      this.startGame();
    });

    this.socket.on("opponent-move", (position) => {
      this.opponent.y = position;
    });

    this.socket.on("ball-update", (ballData) => {
      if (this.playerNumber === 2) {
        this.ball.x = ballData.x;
        this.ball.y = ballData.y;
        this.ball.moveX = ballData.moveX;
        this.ball.moveY = ballData.moveY;
      }
    });

    this.socket.on("score-update", (scores) => {
      this.player.score = this.playerNumber === 1 ? scores.p1 : scores.p2;
      this.opponent.score = this.playerNumber === 1 ? scores.p2 : scores.p1;
      this.checkRoundComplete();
    });

    this.socket.on("opponent-disconnected", () => {
      this.handleOpponentDisconnect();
    });
    this.socket.on("turn-update", (turnData) => {
      this.turn = turnData.turn;
      this.timer = turnData.timer;
    });
  },

  startGame: function () {
    console.log("Starting game...");
    this.waiting = false;
    this.running = true;
    this.over = false;
    this.backgroundMusic.play();
    this.hideWaitingScreen();

    // Initialize ball movement for player 1
    if (this.playerNumber === 1) {
      this.ball.moveX = DIRECTION.RIGHT;
      this.ball.moveY = [DIRECTION.UP, DIRECTION.DOWN][
        Math.round(Math.random())
      ];
    }

    requestAnimationFrame(() => this.loop());
  },

  showWaitingScreen: function (message) {
    // Create or update waiting screen
    let waitingScreen = document.getElementById("waiting-screen");
    if (!waitingScreen) {
      waitingScreen = document.createElement("div");
      waitingScreen.id = "waiting-screen";
      waitingScreen.style.position = "absolute";
      waitingScreen.style.top = "50%";
      waitingScreen.style.left = "50%";
      waitingScreen.style.transform = "translate(-50%, -50%)";
      waitingScreen.style.textAlign = "center";
      waitingScreen.style.color = "white";
      waitingScreen.style.fontSize = "24px";
      document.body.appendChild(waitingScreen);
    }
    waitingScreen.textContent = message;
  },

  hideWaitingScreen: function () {
    const waitingScreen = document.getElementById("waiting-screen");
    if (waitingScreen) {
      waitingScreen.remove();
    }
  },

  loop: function () {
    if (this.running) {
      this.update();
      this.draw();
      requestAnimationFrame(() => this.loop());
    }
  },

  update: function () {
    if (!this.over && !this.waiting) {
      // Update player paddle position
      if (this.player.move === DIRECTION.UP) {
        this.player.y = Math.max(0, this.player.y - this.player.speed);
      } else if (this.player.move === DIRECTION.DOWN) {
        this.player.y = Math.min(
          this.canvas.height - this.player.height,
          this.player.y + this.player.speed
        );
      }

      // Emit player position
      this.socket.emit("player-move", this.player.y);

      // Only player 1 handles ball physics
      if (this.playerNumber === 1) {
        this.updateBall();
        this.socket.emit("ball-update", {
          x: this.ball.x,
          y: this.ball.y,
          moveX: this.ball.moveX,
          moveY: this.ball.moveY,
        });
      }
    }
  },

  updateBall: function () {
    // Handle turn delay for ball resets - add this at the beginning
    if (this._turnDelayIsOver.call(this) && this.turn) {
      this.ball.moveX = this.turn === "left" ? DIRECTION.RIGHT : DIRECTION.LEFT;
      this.ball.moveY = [DIRECTION.UP, DIRECTION.DOWN][
        Math.round(Math.random())
      ];
      this.ball.y = Math.floor(Math.random() * this.canvas.height - 200) + 200;
      this.turn = null;
    }

    // Ball collision with bounds
    if (this.ball.x <= 0) this._resetTurn(this.opponent, this.player);
    if (this.ball.x >= this.canvas.width - this.ball.width)
      this._resetTurn(this.player, this.opponent);
    if (this.ball.y <= 0) this.ball.moveY = DIRECTION.DOWN;
    if (this.ball.y >= this.canvas.height - this.ball.height)
      this.ball.moveY = DIRECTION.UP;

    // Move ball - only if we're not waiting for next turn
    if (this._turnDelayIsOver.call(this)) {
      if (this.ball.moveY === DIRECTION.UP)
        this.ball.y -= this.ball.speed / 1.5;
      else if (this.ball.moveY === DIRECTION.DOWN)
        this.ball.y += this.ball.speed / 1.5;
      if (this.ball.moveX === DIRECTION.LEFT) this.ball.x -= this.ball.speed;
      else if (this.ball.moveX === DIRECTION.RIGHT)
        this.ball.x += this.ball.speed;
    }

    // Handle paddle collisions
    this.checkPaddleCollisions();
  },

  checkPaddleCollisions: function () {
    // Calculate ball movement in this frame
    let nextBallX = this.ball.x;
    let nextBallY = this.ball.y;

    if (this.ball.moveX === DIRECTION.LEFT) nextBallX -= this.ball.speed;
    else if (this.ball.moveX === DIRECTION.RIGHT) nextBallX += this.ball.speed;

    if (this.ball.moveY === DIRECTION.UP) nextBallY -= this.ball.speed / 1.5;
    else if (this.ball.moveY === DIRECTION.DOWN)
      nextBallY += this.ball.speed / 1.5;

    // Player paddle collision (left side)
    if (this.ball.moveX === DIRECTION.LEFT) {
      // Check if ball will cross the paddle in this frame
      if (
        nextBallX <= this.player.x + this.player.width &&
        this.ball.x >= this.player.x + this.player.width &&
        this.ball.y + this.ball.height >= this.player.y &&
        this.ball.y <= this.player.y + this.player.height
      ) {
        // Calculate where along the paddle the ball hit (0-1)
        const hitPos = (this.ball.y - this.player.y) / this.player.height;

        // Adjust angle based on where ball hit the paddle
        if (hitPos < 0.3) this.ball.moveY = DIRECTION.UP;
        else if (hitPos > 0.7) this.ball.moveY = DIRECTION.DOWN;

        this.hitSound1.play();
        this.ball.x = this.player.x + this.player.width;
        this.ball.moveX = DIRECTION.RIGHT;
      }
    }

    // Opponent paddle collision (right side)
    if (this.ball.moveX === DIRECTION.RIGHT) {
      // Check if ball will cross the paddle in this frame
      if (
        nextBallX + this.ball.width >= this.opponent.x &&
        this.ball.x + this.ball.width <= this.opponent.x &&
        this.ball.y + this.ball.height >= this.opponent.y &&
        this.ball.y <= this.opponent.y + this.opponent.height
      ) {
        // Calculate where along the paddle the ball hit (0-1)
        const hitPos = (this.ball.y - this.opponent.y) / this.opponent.height;

        // Adjust angle based on where ball hit the paddle
        if (hitPos < 0.3) this.ball.moveY = DIRECTION.UP;
        else if (hitPos > 0.7) this.ball.moveY = DIRECTION.DOWN;

        this.hitSound.play();
        this.ball.x = this.opponent.x - this.ball.width;
        this.ball.moveX = DIRECTION.LEFT;
      }
    }
  },

  draw: function () {
    // Clear the Canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background
    this.context.fillStyle = this.color;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw paddles and ball
    this.context.fillStyle = "#ffffff";
    this.context.fillRect(
      this.player.x,
      this.player.y,
      this.player.width,
      this.player.height
    );
    this.context.fillRect(
      this.opponent.x,
      this.opponent.y,
      this.opponent.width,
      this.opponent.height
    );

    // Only draw ball if turn delay is over
    if (this._turnDelayIsOver.call(this)) {
      this.context.fillRect(
        this.ball.x,
        this.ball.y,
        this.ball.width,
        this.ball.height
      );
    }

    // Draw the net
    this.context.beginPath();
    this.context.setLineDash([7, 15]);
    this.context.moveTo(this.canvas.width / 2, this.canvas.height - 140);
    this.context.lineTo(this.canvas.width / 2, 140);
    this.context.lineWidth = 10;
    this.context.strokeStyle = "#ffffff";
    this.context.stroke();

    // Draw scores
    this.context.font = "100px Courier New";
    this.context.textAlign = "center";
    this.context.fillText(
      this.player.score.toString(),
      this.canvas.width / 2 - 300,
      200
    );
    this.context.fillText(
      this.opponent.score.toString(),
      this.canvas.width / 2 + 300,
      200
    );

    // Draw round info
    this.context.font = "30px Courier New";
    this.context.fillText(
      "Round " + (this.round + 1),
      this.canvas.width / 2,
      35
    );
    this.context.font = "40px Courier";
    this.context.fillText(
      rounds[this.round] ? rounds[this.round] : rounds[this.round - 1],
      this.canvas.width / 2,
      100
    );
  },

  checkRoundComplete: function () {
    if (
      this.player.score === rounds[this.round] ||
      this.opponent.score === rounds[this.round]
    ) {
      if (this.player.score === rounds[this.round]) {
        if (!rounds[this.round + 1]) {
          this.endGame("Winner!");
        } else {
          this.advanceRound();
        }
      } else {
        this.endGame("Game Over!");
      }
    }
  },

  advanceRound: function () {
    this.color = this._generateRoundColor();
    this.player.score = this.opponent.score = 0;
    this.player.speed += 0.5;
    this.opponent.speed += 0.5;
    this.ball.speed += 1;
    this.round += 1;
  },

  endGame: function (message) {
    this.over = true;
    if (message === "Winner!") {
      this.winSound.play();
    } else {
      this.loseSound.play();
    }

    setTimeout(() => {
      this.showEndGameMenu(message);
    }, 1000);
  },

  showEndGameMenu: function (text) {
    this.context.font = "45px Courier New";
    this.context.fillStyle = this.color;
    this.context.fillRect(
      this.canvas.width / 2 - 350,
      this.canvas.height / 2 - 48,
      700,
      100
    );
    this.context.fillStyle = "#ffffff";
    this.context.fillText(
      text,
      this.canvas.width / 2,
      this.canvas.height / 2 + 15
    );

    setTimeout(() => {
      location.reload();
    }, 3000);
  },

  handleOpponentDisconnect: function () {
    this.running = false;
    this.over = true;
    this.waiting = true;
    this.showWaitingScreen("Opponent disconnected. Reloading...");
    setTimeout(() => {
      location.reload();
    }, 2000);
  },

  listen: function () {
    document.addEventListener("keydown", (key) => {
      if (key.keyCode === 38 || key.keyCode === 87)
        this.player.move = DIRECTION.UP;
      if (key.keyCode === 40 || key.keyCode === 83)
        this.player.move = DIRECTION.DOWN;
    });

    document.addEventListener("keyup", () => {
      this.player.move = DIRECTION.IDLE;
    });
  },
  _turnDelayIsOver: function () {
    return new Date().getTime() - this.timer >= 1000;
  },
  _resetTurn: function (victor, loser) {
    this.ball = Ball.new.call(this, this.ball.speed);
    this.timer = new Date().getTime();
    this.turn = victor === this.player ? "right" : "left";

    victor.score++;
    this.scoreSound.play();

    // Emit score update
    this.socket.emit("score-update", {
      p1: this.playerNumber === 1 ? victor.score : loser.score,
      p2: this.playerNumber === 1 ? loser.score : victor.score,
    });
    this.socket.emit("turn-update", {
      turn: this.turn,
      timer: this.timer,
    });
  },

  _generateRoundColor: function () {
    const newColor = colors[Math.floor(Math.random() * colors.length)];
    if (newColor === this.color) return this._generateRoundColor();
    return newColor;
  },
};

// Initialize game
const Pong = Object.assign({}, Game);
Pong.initialize();
