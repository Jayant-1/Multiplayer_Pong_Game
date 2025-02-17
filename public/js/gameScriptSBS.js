// Global Variables
var DIRECTION = {
  IDLE: 0,
  UP: 1,
  DOWN: 2,
  LEFT: 3,
  RIGHT: 4,
};

var rounds = [5, 5, 3, 3, 2];
var colors = ["#1abc9c", "#2ecc71", "#3498db", "#8c52ff", "#9b59b6"];

// The ball object (The cube that bounces back and forth)
var Ball = {
  new: function (incrementedSpeed) {
    return {
      width: 18,
      height: 18,
      x: this.canvas.width / 2 - 9,
      y: this.canvas.height / 2 - 9,
      moveX: DIRECTION.IDLE,
      moveY: DIRECTION.IDLE,
      speed: incrementedSpeed || 7,
    };
  },
};

// The paddle object (The two lines that move up and down)
var Paddle = {
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

var Game = {
  initialize: function () {
    this.canvas = document.querySelector("canvas");
    this.context = this.canvas.getContext("2d");

    this.canvas.width = 1400;
    this.canvas.height = 1000;

    this.canvas.style.width = this.canvas.width / 2 + "px";
    this.canvas.style.height = this.canvas.height / 2 + "px";

    this.player1 = Paddle.new.call(this, "left");
    this.player2 = Paddle.new.call(this, "right");
    this.ball = Ball.new.call(this);

    this.running = this.over = false;
    this.turn = this.player2;
    this.timer = this.round = 0;
    this.color = "#8c52ff";

    // Load audio files
    this.hitSound = new Audio("../audio/hit.mp3");
    this.hitSound1 = new Audio("../audio/hit.mp3");
    this.scoreSound = new Audio("../audio/score.mp3");
    this.winSound = new Audio("../audio/win.mp3");
    this.loseSound = new Audio("../audio/lose.mp3");
    this.backgroundMusic = new Audio("../audio/background_music.mp3");
    this.backgroundMusic.loop = true;

    // Play background music
    this.backgroundMusic.play();
    // Set dark mode as default
    document.body.classList.add("dark-mode");

    Pong.menu();
    Pong.listen();

    document
      .getElementById("dark-mode-toggle")
      .addEventListener("click", function () {
        document.body.classList.toggle("dark-mode");
        this.classList.toggle("dark-mode");
      });
  },

  endGameMenu: function (text) {
    Pong.context.font = "45px Courier New";
    Pong.context.fillStyle = this.color;

    Pong.context.fillRect(
      Pong.canvas.width / 2 - 350,
      Pong.canvas.height / 2 - 48,
      700,
      100
    );

    Pong.context.fillStyle = "#ffffff";

    Pong.context.fillText(
      text,
      Pong.canvas.width / 2,
      Pong.canvas.height / 2 + 15
    );

    setTimeout(function () {
      Pong = Object.assign({}, Game);
      Pong.initialize();
    }, 3000);
  },

  menu: function () {
    Pong.draw();

    this.context.font = "50px Courier New";
    this.context.fillStyle = this.color;

    this.context.fillRect(
      this.canvas.width / 2 - 350,
      this.canvas.height / 2 - 48,
      700,
      100
    );

    this.context.fillStyle = "#ffffff";

    this.context.fillText(
      "Press any key to begin",
      this.canvas.width / 2,
      this.canvas.height / 2 + 15
    );
  },

  update: function () {
    if (!this.over) {
      // Ball collision with bounds
      if (this.ball.x <= 0)
        Pong._resetTurn.call(this, this.player2, this.player1);
      if (this.ball.x >= this.canvas.width - this.ball.width)
        Pong._resetTurn.call(this, this.player1, this.player2);
      if (this.ball.y <= 0) this.ball.moveY = DIRECTION.DOWN;
      if (this.ball.y >= this.canvas.height - this.ball.height)
        this.ball.moveY = DIRECTION.UP;

      // Move player1
      if (this.player1.move === DIRECTION.UP)
        this.player1.y -= this.player1.speed;
      else if (this.player1.move === DIRECTION.DOWN)
        this.player1.y += this.player1.speed;

      // Move player2
      if (this.player2.move === DIRECTION.UP)
        this.player2.y -= this.player2.speed;
      else if (this.player2.move === DIRECTION.DOWN)
        this.player2.y += this.player2.speed;

      // Handle new serve
      if (Pong._turnDelayIsOver.call(this) && this.turn) {
        this.ball.moveX =
          this.turn === this.player1 ? DIRECTION.LEFT : DIRECTION.RIGHT;
        this.ball.moveY = [DIRECTION.UP, DIRECTION.DOWN][
          Math.round(Math.random())
        ];
        this.ball.y =
          Math.floor(Math.random() * this.canvas.height - 200) + 200;
        this.turn = null;
      }

      // Handle player1 wall collision
      if (this.player1.y <= 0) this.player1.y = 0;
      else if (this.player1.y >= this.canvas.height - this.player1.height)
        this.player1.y = this.canvas.height - this.player1.height;

      // Handle player2 wall collision
      if (this.player2.y <= 0) this.player2.y = 0;
      else if (this.player2.y >= this.canvas.height - this.player2.height)
        this.player2.y = this.canvas.height - this.player2.height;

      // Move ball
      if (this.ball.moveY === DIRECTION.UP)
        this.ball.y -= this.ball.speed / 1.5;
      else if (this.ball.moveY === DIRECTION.DOWN)
        this.ball.y += this.ball.speed / 1.5;
      if (this.ball.moveX === DIRECTION.LEFT) this.ball.x -= this.ball.speed;
      else if (this.ball.moveX === DIRECTION.RIGHT)
        this.ball.x += this.ball.speed;

      // Handle Player1-Ball collisions
      if (
        this.ball.x - this.ball.width <= this.player1.x &&
        this.ball.x >= this.player1.x - this.player1.width
      ) {
        if (
          this.ball.y <= this.player1.y + this.player1.height &&
          this.ball.y + this.ball.height >= this.player1.y
        ) {
          this.hitSound1.play();
          this.ball.x = this.player1.x + this.ball.width;
          this.ball.moveX = DIRECTION.RIGHT;
        }
      }

      // Handle Player2-Ball collisions
      if (
        this.ball.x - this.ball.width <= this.player2.x &&
        this.ball.x >= this.player2.x - this.player2.width
      ) {
        if (
          this.ball.y <= this.player2.y + this.player2.height &&
          this.ball.y + this.ball.height >= this.player2.y
        ) {
          this.hitSound.play();
          this.ball.x = this.player2.x - this.ball.width;
          this.ball.moveX = DIRECTION.LEFT;
        }
      }
    }

    // Handle the end of round transition
    if (this.player1.score === rounds[this.round]) {
      if (!rounds[this.round + 1]) {
        this.over = true;
        this.winSound.play();
        setTimeout(function () {
          Pong.endGameMenu("Player 1 Wins!");
        }, 1000);
      } else {
        this.color = this._generateRoundColor();
        this.player1.score = this.player2.score = 0;
        this.player1.speed += 0.5;
        this.player2.speed += 0.5;
        this.ball.speed += 1;
        this.round += 1;
      }
    } else if (this.player2.score === rounds[this.round]) {
      if (!rounds[this.round + 1]) {
        this.over = true;
        this.winSound.play();
        setTimeout(function () {
          Pong.endGameMenu("Player 2 Wins!");
        }, 1000);
      } else {
        this.color = this._generateRoundColor();
        this.player1.score = this.player2.score = 0;
        this.player1.speed += 0.5;
        this.player2.speed += 0.5;
        this.ball.speed += 1;
        this.round += 1;
      }
    }
  },

  draw: function () {
    // Clear the Canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.context.fillStyle = this.color;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.context.fillStyle = "#ffffff";

    // Draw Player1
    this.context.fillRect(
      this.player1.x,
      this.player1.y,
      this.player1.width,
      this.player1.height
    );

    // Draw Player2
    this.context.fillRect(
      this.player2.x,
      this.player2.y,
      this.player2.width,
      this.player2.height
    );

    // Draw Ball
    if (Pong._turnDelayIsOver.call(this)) {
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

    // Draw player1 score
    this.context.fillText(
      this.player1.score.toString(),
      this.canvas.width / 2 - 300,
      200
    );

    // Draw player2 score
    this.context.fillText(
      this.player2.score.toString(),
      this.canvas.width / 2 + 300,
      200
    );

    // Draw round number
    this.context.font = "30px Courier New";
    this.context.fillText(
      "Round " + (Pong.round + 1),
      this.canvas.width / 2,
      35
    );

    this.context.font = "40px Courier";
    this.context.fillText(
      rounds[Pong.round] ? rounds[Pong.round] : rounds[Pong.round - 1],
      this.canvas.width / 2,
      100
    );
  },

  loop: function () {
    Pong.update();
    Pong.draw();

    if (!Pong.over) requestAnimationFrame(Pong.loop);
  },

  listen: function () {
    document.addEventListener("keydown", function (key) {
      // Handle game start
      if (Pong.running === false) {
        Pong.running = true;
        window.requestAnimationFrame(Pong.loop);
      }

      // Player 1 controls (W and S keys)
      if (key.keyCode === 87) Pong.player1.move = DIRECTION.UP;
      if (key.keyCode === 83) Pong.player1.move = DIRECTION.DOWN;

      // Player 2 controls (Up and Down arrows)
      if (key.keyCode === 38) Pong.player2.move = DIRECTION.UP;
      if (key.keyCode === 40) Pong.player2.move = DIRECTION.DOWN;
    });

    // Stop paddles on key release
    document.addEventListener("keyup", function (key) {
      // Player 1
      if (key.keyCode === 87 || key.keyCode === 83)
        Pong.player1.move = DIRECTION.IDLE;

      // Player 2
      if (key.keyCode === 38 || key.keyCode === 40)
        Pong.player2.move = DIRECTION.IDLE;
    });
  },

  _resetTurn: function (victor, loser) {
    this.ball = Ball.new.call(this, this.ball.speed);
    this.turn = loser;
    this.timer = new Date().getTime();

    victor.score++;
    this.scoreSound.play();
  },

  _turnDelayIsOver: function () {
    return new Date().getTime() - this.timer >= 1000;
  },

  _generateRoundColor: function () {
    var newColor = colors[Math.floor(Math.random() * colors.length)];
    if (newColor === this.color) return Pong._generateRoundColor();
    return newColor;
  },
};

var Pong = Object.assign({}, Game);
Pong.initialize();
