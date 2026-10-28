import { overlaps } from './collision.js';

export class Player {
  static WIDTH = 34;
  static HEIGHT = 46;
  static SPEED = 290;     // пикселей в секунду
  static JUMP = 680;      // импульс прыжка вверх
  static GRAVITY = 1580;  // пикселей в секунду в квадрате

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = Player.WIDTH;
    this.h = Player.HEIGHT;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.walkCycle = 0;
  }

  update(dt, input, solids, worldWidth) {
    const direction = input.direction();
    this.vx = direction * Player.SPEED;
    if (direction !== 0) this.facing = direction;

    // Прыжок только с опоры. В воздухе повторное нажатие ничего не делает.
    if (input.consumeJump() && this.onGround) {
      this.vy = -Player.JUMP;
      this.onGround = false;
    }

    // Сначала движение по X и реакция на боковые стенки.
    this.x += this.vx * dt;
    for (const solid of solids) {
      if (!overlaps(this, solid)) continue;
      if (this.vx > 0) this.x = solid.x - this.w;
      if (this.vx < 0) this.x = solid.x + solid.w;
    }
    this.x = Math.max(0, Math.min(worldWidth - this.w, this.x));

    // Затем движение по Y. Проверяем переход через поверхность за кадр.
    this.vy += Player.GRAVITY * dt;
    const previousTop = this.y;
    const previousBottom = this.y + this.h;
    this.y += this.vy * dt;
    this.onGround = false;

    for (const solid of solids) {
      if (this.x + this.w <= solid.x || this.x >= solid.x + solid.w) continue;
      if (this.vy >= 0 && previousBottom <= solid.y + 2 && this.y + this.h >= solid.y) {
        this.y = solid.y - this.h;
        this.vy = 0;
        this.onGround = true;
      } else if (this.vy < 0 && previousTop >= solid.y + solid.h - 2 &&
                 this.y <= solid.y + solid.h) {
        this.y = solid.y + solid.h;
        this.vy = 0;
      }
    }

    if (this.onGround && direction !== 0) this.walkCycle += dt * 13;
    else this.walkCycle = 0;
  }
}
