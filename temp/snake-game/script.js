const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// 游戏配置
const gridSize = 20;
const tileCount = 20;
let velocityX = 0;
let velocityY = 0;

// 蛇的初始位置（在中间）
let snakeX = 10 * gridSize;
let snakeY = 10 * gridSize;

// 蛇的身体
let snakeBody = [];
let tailLength = 5;

// 食物的初始位置
let foodX = Math.floor(Math.random() * tileCount) * gridSize;
let foodY = Math.floor(Math.random() * tileCount) * gridSize;

// 主游戏循环
function gameLoop() {
  changeSnakePosition();

  // 检查是否吃到食物
  let result = isGameOver();
  if (result) return;

  clearScreen();
  checkFoodCollision();
  drawFood();
  drawSnake();

  setTimeout(gameLoop, 100); // 控制游戏速度
}

function changeSnakePosition() {
  snakeX += velocityX;
  snakeY += velocityY;
}

function isGameOver() {
  let gameOver = false;

  if (velocityX === 0 && velocityY === 0) return false;

  // 撞墙
  if (snakeX < 0 || snakeY < 0 || snakeX >= canvas.width || snakeY >= canvas.height) {
    gameOver = true;
  }

  // 撞到自己
  for (let i = 0; i < snakeBody.length; i++) {
    let part = snakeBody[i];
    if (part.x === snakeX && part.y === snakeY) {
      gameOver = true;
      break;
    }
  }

  if (gameOver) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = '30px Arial';
    ctx.fillText('游戏结束！', canvas.width / 2 - 70, canvas.height / 2);
    ctx.font = '20px Arial';
    ctx.fillText('刷新页面重新开始', canvas.width / 2 - 90, canvas.height / 2 + 40);
  }

  return gameOver;
}

function clearScreen() {
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawFood() {
  ctx.fillStyle = 'red';
  ctx.fillRect(foodX, foodY, gridSize, gridSize);
}

function checkFoodCollision() {
  if (snakeX === foodX && snakeY === foodY) {
    tailLength++;
    foodX = Math.floor(Math.random() * tileCount) * gridSize;
    foodY = Math.floor(Math.random() * tileCount) * gridSize;
  }
}

function drawSnake() {
  ctx.fillStyle = 'green';
  for (let i = 0; i < snakeBody.length; i++) {
    let part = snakeBody[i];
    ctx.fillRect(part.x, part.y, gridSize, gridSize);
  }
  ctx.fillRect(snakeX, snakeY, gridSize, gridSize);

  // 将当前头部位置加入身体
  snakeBody.push({ x: snakeX, y: snakeY });
  // 保持蛇的长度
  while (snakeBody.length > tailLength) {
    snakeBody.shift();
  }
}

// 键盘控制
document.body.addEventListener('keydown', function (e) {
  // 上
  if (e.key === 'ArrowUp' && velocityY === 0) {
    velocityX = 0;
    velocityY = -gridSize;
  }
  // 下
  if (e.key === 'ArrowDown' && velocityY === 0) {
    velocityX = 0;
    velocityY = gridSize;
  }
  // 左
  if (e.key === 'ArrowLeft' && velocityX === 0) {
    velocityX = -gridSize;
    velocityY = 0;
  }
  // 右
  if (e.key === 'ArrowRight' && velocityX === 0) {
    velocityX = gridSize;
    velocityY = 0;
  }
});

// 开始游戏
gameLoop();