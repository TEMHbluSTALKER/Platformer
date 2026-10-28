import { Player } from './Player.js';
import { overlaps, circleTouchesRect } from './collision.js';

const VIEW_W = 1000;
const VIEW_H = 560;
// Каждый уровень описан данными. Физика, рисование и управление общие.
const BEST_KEY = 'polar-expedition-best-v2';
export const LEVELS = [
  {
    title: 'Ледяной маршрут', sector: 'СЕКТОР 07 · ЛЕДЯНОЙ МАРШРУТ',
    worldWidth: 2490,
    land: [
      { x: 0, y: 456, w: 350, h: 200 },
      { x: 2005, y: 456, w: 485, h: 200 },
    ],
    platforms: [
      { x: 415, y: 410, w: 245, h: 25 },
      { x: 735, y: 365, w: 245, h: 25 },
      { x: 1060, y: 402, w: 270, h: 25 },
      { x: 1405, y: 351, w: 245, h: 25 },
      { x: 1720, y: 406, w: 230, h: 25 },
    ],
    items: [{ x: 530, y: 375 }, { x: 1145, y: 365 }, { x: 1830, y: 370 }],
    hazards: [
      { x: 350, y: 501, w: 1655, h: 70, kind: 'water' },
      { x: 1236, y: 384, w: 56, h: 18, kind: 'crack' },
    ],
    exit: { x: 2198, y: 384, w: 60, h: 72 },
  },
  {
    title: 'Сквозь снежную бурю', sector: 'СЕКТОР 08 · СНЕЖНАЯ БУРЯ',
    worldWidth: 2570,
    land: [
      { x: 0, y: 456, w: 340, h: 200 },
      { x: 2065, y: 456, w: 505, h: 200 },
    ],
    platforms: [
      { x: 405, y: 414, w: 240, h: 25 },
      { x: 720, y: 366, w: 235, h: 25 },
      { x: 1034, y: 398, w: 240, h: 25 },
      { x: 1353, y: 355, w: 258, h: 25 },
      { x: 1688, y: 397, w: 265, h: 25 },
    ],
    items: [{ x: 523, y: 379 }, { x: 1092, y: 362 }, { x: 1786, y: 360 }],
    hazards: [
      { x: 340, y: 501, w: 1725, h: 70, kind: 'water' },
      { x: 1186, y: 380, w: 56, h: 18, kind: 'crack' },
      { x: 1880, y: 379, w: 48, h: 18, kind: 'crack' },
    ],
    exit: { x: 2260, y: 384, w: 60, h: 72 },
  },
];

function roundedRect(ctx, x, y, w, h, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function polygon(ctx, points, fill) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function formatTime(seconds) {
  const all = Math.floor(seconds);
  return `${String(Math.floor(all / 60)).padStart(2, '0')}:${String(all % 60).padStart(2, '0')}`;
}

export class Game {
  constructor(canvas, { onStateChange = () => {}, onHudChange = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D не поддерживается браузером');
    this.onStateChange = onStateChange;
    this.onHudChange = onHudChange;
    this.input = null;
    this.animationStarted = false;
    this.previousFrame = null;
    this.cameraX = 0;
    this.best = this.loadBest();
    this.snow = Array.from({ length: 80 }, (_, i) => ({
      x: (i * 157.7 + 13) % VIEW_W,
      y: (i * 97.23 + 19) % VIEW_H,
      r: 0.9 + (i % 4) * 0.45,
      speed: 12 + (i * 7) % 27,
    }));
    this.stars = Array.from({ length: 64 }, (_, i) => ({
      x: (i * 211.7 + 107) % VIEW_W,
      y: (i * 67.87 + 17) % 255,
      r: 0.6 + (i % 3) * 0.45,
    }));
    this.reset();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    this.resize();
  }

  setInput(input) { this.input = input; }

  loadBest() {
    try {
      const value = Number(localStorage.getItem(BEST_KEY));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch { return 0; } // в приватном режиме хранилище бывает недоступно
  }

  saveBest() {
    try { localStorage.setItem(BEST_KEY, String(this.best)); }
    catch { /* рекорд остаётся доступным до закрытия текущей страницы */ }
  }

  resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(VIEW_W * pixelRatio);
    this.canvas.height = Math.round(VIEW_H * pixelRatio);
    this.pixelRatio = pixelRatio;
    this.render();
  }

  reset() {
    this.score = 0;
    this.elapsed = 0;
    this.loadLevel(0);
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.worldWidth = this.level.worldWidth;
    this.solids = [...this.level.land, ...this.level.platforms];
    this.player = new Player(90, this.level.land[0].y - Player.HEIGHT);
    this.player.onGround = true;
    this.items = this.level.items.map((item) => ({ ...item, collected: false }));
    this.collected = 0;
    // Контрольная точка — начало уровня. Повтор не позволяет накрутить очки.
    this.levelStartScore = this.score;
    this.levelStartElapsed = this.elapsed;
    this.notice = '';
    this.noticeTimer = 0;
    this.hudTimer = 0;
    this.cameraX = 0;
    this.previousFrame = null;
    this.state = 'ready';
    this.input?.clear();
    this.emit();
  }

  retryLevel() {
    this.score = this.levelStartScore;
    this.elapsed = this.levelStartElapsed;
    this.loadLevel(this.levelIndex);
    this.start();
  }

  start() {
    if (this.state === 'playing' || document.hidden) return;
    if (this.state === 'won') this.reset();
    else if (this.state === 'lost') { this.retryLevel(); return; }
    else if (this.state === 'level-complete') this.loadLevel(this.levelIndex + 1);
    if (this.state !== 'ready' && this.state !== 'paused') return;
    this.state = 'playing';
    this.previousFrame = null; // не учитывать время, прошедшее в паузе
    this.input?.clear();
    this.emit();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.previousFrame = null;
    this.input?.clear();
    this.emit();
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.start();
  }

  restart() {
    this.reset(); // «Заново» всегда начинает экспедицию с первого уровня
    this.start();
  }

  finishLevel() {
    if (this.state !== 'playing') return;
    this.score += 250; // бонус за прохождение каждого уровня
    if (this.levelIndex < LEVELS.length - 1) {
      this.state = 'level-complete';
    } else {
      const speedBonus = Math.max(0, Math.round(700 - this.elapsed * 10));
      this.score += speedBonus;
      this.state = 'won';
      if (this.score > this.best) { this.best = this.score; this.saveBest(); }
    }
    this.input?.clear();
    this.emit();
  }

  lose() {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.input?.clear();
    this.emit();
  }

  get snapshot() {
    return {
      state: this.state,
      collected: this.collected,
      total: this.items.length,
      level: this.levelIndex + 1,
      levelCount: LEVELS.length,
      levelName: this.level.title,
      score: this.score,
      best: this.best,
      elapsed: this.elapsed,
      time: formatTime(this.elapsed),
    };
  }

  emit() {
    const info = this.snapshot;
    this.onHudChange(info);
    this.onStateChange(info);
  }

  begin() {
    // Единственная цепочка requestAnimationFrame за всё время жизни игры.
    if (this.animationStarted) return;
    this.animationStarted = true;
    requestAnimationFrame((timestamp) => this.frame(timestamp));
  }

  frame(timestamp) {
    if (this.state === 'playing') {
      const dt = this.previousFrame === null
        ? 0 : Math.min((timestamp - this.previousFrame) / 1000, 0.033);
      this.update(dt);
    }
    this.previousFrame = timestamp;
    this.render();
    requestAnimationFrame((next) => this.frame(next));
  }

  update(dt) {
    if (!this.input || this.state !== 'playing') return;
    this.elapsed += dt;
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    this.player.update(dt, this.input, this.solids, this.worldWidth);

    // Камера плавно следует за игроком. Координаты мира при этом не меняются.
    const target = Math.max(0, Math.min(this.worldWidth - VIEW_W, this.player.x - VIEW_W * 0.33));
    this.cameraX += (target - this.cameraX) * Math.min(1, dt * 8);

    for (const item of this.items) {
      if (!item.collected && circleTouchesRect(item.x, item.y, 20, this.player)) {
        item.collected = true;
        this.collected += 1;
        this.score += 100;
        this.onHudChange(this.snapshot);
      }
    }

    if (this.level.hazards.some((hazard) => overlaps(this.player, hazard)) || this.player.y > VIEW_H + 90) {
      this.lose();
      return;
    }

    if (overlaps(this.player, this.level.exit)) {
      if (this.collected === this.items.length) this.finishLevel();
      else if (this.noticeTimer <= 0) {
        this.notice = `Для финиша нужно собрать ещё ${this.items.length - this.collected} кр.`;
        this.noticeTimer = 2.2;
      }
    }

    this.hudTimer = (this.hudTimer || 0) + dt;
    if (this.hudTimer > 0.1) {
      this.onHudChange(this.snapshot);
      this.hudTimer = 0;
    }
  }

  render() {
    if (!this.ctx || !this.player) return;
    const ctx = this.ctx;
    ctx.setTransform(this.pixelRatio || 1, 0, 0, this.pixelRatio || 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this.drawSky(ctx);
    ctx.save();
    ctx.translate(-Math.round(this.cameraX), 0);
    this.drawSea(ctx);
    for (const land of this.level.land) this.drawLand(ctx, land);
    for (const platform of this.level.platforms) this.drawPlatform(ctx, platform);
    this.drawCrack(ctx);
    this.drawArtifacts(ctx);
    this.drawExit(ctx);
    this.drawExplorer(ctx);
    ctx.restore();
    this.drawSnow(ctx);
    this.drawNotice(ctx);
  }

  drawSky(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    const storm = this.levelIndex === 1;
    gradient.addColorStop(0, storm ? '#110f35' : '#081d38');
    gradient.addColorStop(0.48, storm ? '#35355d' : '#245370');
    gradient.addColorStop(0.84, storm ? '#566487' : '#34738a');
    gradient.addColorStop(1, storm ? '#213a62' : '#103a59');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const glow = ctx.createRadialGradient(760, 120, 10, 760, 120, 340);
    glow.addColorStop(0, storm ? '#c8a4ff3b' : '#67dfb92d');
    glow.addColorStop(1, '#67dfb900');
    ctx.fillStyle = glow;
    ctx.fillRect(250, 0, 750, 410);

    const shift = this.cameraX * 0.05;
    for (const star of this.stars) {
      ctx.globalAlpha = 0.28 + 0.45 * (0.5 + 0.5 * Math.sin(this.elapsed * 0.8 + star.x));
      ctx.fillStyle = '#e5fff7';
      ctx.beginPath();
      ctx.arc((star.x - shift + 2 * VIEW_W) % VIEW_W, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Северное сияние — плавные полупрозрачные ленты.
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const offset = Math.sin(this.elapsed * 0.23 + i) * 12;
      ctx.moveTo(-100, 62 + i * 17);
      ctx.bezierCurveTo(245, 35 + i * 14 + offset, 460, 165 + i * 15, 1090, 36 + i * 30);
      ctx.bezierCurveTo(540, 196 + i * 12, 250, 93 + i * 17 + offset, -100, 101 + i * 19);
      ctx.closePath();
      ctx.fillStyle = (storm ? ['#b99cff21', '#a4dcff1d', '#6a9ae921', '#e6a3fa14'] : ['#61f3b315', '#97f5d51d', '#43a9eb13', '#77ffd00d'])[i];
      ctx.fill();
    }

    // Многослойные горы с параллаксом.
    const backShift = (this.cameraX * 0.1) % 490;
    for (let repeat = -1; repeat < 4; repeat++) {
      const x = repeat * 490 - backShift;
      polygon(ctx, [[x - 160, 445], [x + 85, 198], [x + 350, 445]], storm ? '#35365e' : '#244c66');
      polygon(ctx, [[x - 20, 307], [x + 85, 198], [x + 182, 305], [x + 123, 285], [x + 85, 248], [x + 45, 286]], '#a0d7dd7a');
    }
    const frontShift = (this.cameraX * 0.22) % 610;
    for (let repeat = -1; repeat < 3; repeat++) {
      const x = repeat * 610 - frontShift;
      polygon(ctx, [[x - 90, 510], [x + 145, 309], [x + 410, 510]], storm ? '#303b65' : '#1b4660');
      polygon(ctx, [[x + 58, 382], [x + 145, 309], [x + 240, 385], [x + 176, 364], [x + 146, 343], [x + 104, 370]], '#a7e4e580');
    }
    const haze = ctx.createLinearGradient(0, 380, 0, 520);
    haze.addColorStop(0, '#a7e5e500');
    haze.addColorStop(1, '#91cbdc5b');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 380, VIEW_W, 140);
  }

  drawSea(ctx) {
    const sea = ctx.createLinearGradient(0, 495, 0, 565);
    sea.addColorStop(0, '#123e65');
    sea.addColorStop(1, '#071c37');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 499, this.worldWidth, 100);
    for (let i = 0; i < 55; i++) {
      const x = i * 53 + Math.sin(this.elapsed * 1.1 + i) * 9;
      const y = 505 + (i % 4) * 12;
      ctx.fillStyle = i % 2 ? '#7fd0e640' : '#daffff24';
      roundedRect(ctx, x, y, 28 + (i % 4) * 9, 2, 1, ctx.fillStyle);
    }
    // Граница опасной ледяной воды.
    ctx.strokeStyle = '#7edbe870';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const water = this.level.hazards.find(h => h.kind === 'water');
    ctx.moveTo(water.x, 501);
    for (let x = water.x; x <= water.x + water.w; x += 13) {
      ctx.lineTo(x, 501 + Math.sin(x * 0.031 + this.elapsed * 1.6) * 3);
    }
    ctx.stroke();
  }

  drawLand(ctx, p) {
    ctx.fillStyle = '#244c64';
    ctx.fillRect(p.x, p.y, p.w, VIEW_H - p.y + 50);
    ctx.fillStyle = '#3d7182';
    for (let i = 0; i < 11; i++) {
      const x = p.x + 16 + i * 40;
      polygon(ctx, [[x, p.y + 24], [x + 10, p.y + 65], [x + 6, p.y + 83], [x - 8, p.y + 40]], '#19435c');
    }
    roundedRect(ctx, p.x - 2, p.y - 11, p.w + 4, 21, 8, '#e4f7f1', '#b7e9eb');
    roundedRect(ctx, p.x, p.y + 6, p.w, 7, 2, '#a3d8e1');
    for (let i = 0; i < p.w / 48; i++) {
      const x = p.x + 18 + i * 48;
      polygon(ctx, [[x, p.y + 12], [x + 15, p.y + 12], [x + 9, p.y + 21 + (i % 3) * 7]], '#a9eaf1');
    }
  }

  drawPlatform(ctx, p) {
    ctx.fillStyle = '#092b47aa';
    roundedRect(ctx, p.x + 6, p.y + 12, p.w, p.h + 20, 10, ctx.fillStyle);
    const ice = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    ice.addColorStop(0, '#b9eff2');
    ice.addColorStop(0.28, '#71c4da');
    ice.addColorStop(1, '#286b90');
    roundedRect(ctx, p.x, p.y, p.w, p.h, 7, ice, '#e5ffff');
    roundedRect(ctx, p.x + 9, p.y + 4, p.w - 18, 4, 2, '#e3ffffa5');
    for (let i = 0; i < Math.floor(p.w / 45); i++) {
      const x = p.x + 17 + i * 45;
      const h = 9 + (i * 13) % 18;
      polygon(ctx, [[x, p.y + p.h - 1], [x + 16, p.y + p.h - 1], [x + 7, p.y + p.h + h]], '#5aacc6');
    }
    ctx.strokeStyle = '#e6ffff6b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(p.x + 45, p.y + 13);
    ctx.lineTo(p.x + 61, p.y + 18);
    ctx.lineTo(p.x + 90, p.y + 13);
    ctx.stroke();
  }

  drawCrack(ctx) {
    for (const h of this.level.hazards.filter(h => h.kind === 'crack')) {
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#ff516f';
      polygon(ctx, [[h.x, h.y + 17], [h.x + 5, h.y + 6], [h.x + 15, h.y + 13],
        [h.x + 23, h.y], [h.x + 37, h.y + 13], [h.x + 48, h.y + 5],
        [h.x + h.w, h.y + 18]], '#ff6f7b');
      ctx.restore();
      ctx.strokeStyle = '#ffd4ba';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.x + 15, h.y + 12);
      ctx.lineTo(h.x + 23, h.y);
      ctx.lineTo(h.x + 37, h.y + 13);
      ctx.stroke();
    }
  }

  drawArtifacts(ctx) {
    this.items.forEach((item, index) => {
      if (item.collected) return;
      const bob = Math.sin(this.elapsed * 2.6 + index * 2) * 6;
      const x = item.x;
      const y = item.y + bob;
      ctx.save();
      ctx.shadowColor = '#77ffe0';
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#6affd070';
      ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 8;
      polygon(ctx, [[x, y - 18], [x + 13, y - 4], [x + 8, y + 12], [x, y + 19], [x - 12, y + 2], [x - 9, y - 10]], '#a4ffef');
      polygon(ctx, [[x, y - 18], [x + 13, y - 4], [x, y + 19]], '#61d5d5');
      polygon(ctx, [[x, y - 18], [x - 9, y - 10], [x - 12, y + 2], [x, y + 19]], '#eafff9');
      ctx.restore();
      ctx.font = '700 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ebfffc';
      ctx.fillText(`0${index + 1}`, x, y - 28);
    });
  }

  drawExit(ctx) {
    const EXIT = this.level.exit;
    const x = EXIT.x - 46, y = EXIT.y - 46;
    // Светящийся терминал станции и маяк.
    ctx.fillStyle = '#17445a';
    roundedRect(ctx, x, y + 35, 150, 83, 8, ctx.fillStyle, '#70c5cf');
    polygon(ctx, [[x - 11, y + 42], [x + 75, y - 2], [x + 161, y + 42]], '#d9f4f0');
    polygon(ctx, [[x + 8, y + 41], [x + 75, y + 7], [x + 142, y + 41]], '#3d8094');
    roundedRect(ctx, x + 16, y + 52, 32, 22, 3, '#9adddf', '#d6fff8');
    ctx.strokeStyle = '#42758f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 32, y + 53); ctx.lineTo(x + 32, y + 74); ctx.stroke();
    const unlocked = this.collected === this.items.length;
    const beam = ctx.createRadialGradient(EXIT.x + 30, y + 82, 8, EXIT.x + 30, y + 82, 74);
    beam.addColorStop(0, unlocked ? '#5bf9b985' : '#a5b5d125');
    beam.addColorStop(1, '#5bf9b900');
    ctx.fillStyle = beam;
    ctx.fillRect(EXIT.x - 55, y + 6, 165, 150);
    roundedRect(ctx, EXIT.x + 1, y + 48, 59, 70, 7, unlocked ? '#44bda0' : '#23435a', unlocked ? '#adffcb' : '#8bb4c5');
    roundedRect(ctx, EXIT.x + 11, y + 60, 40, 48, 4, unlocked ? '#b3ffdf' : '#28556a');
    ctx.fillStyle = unlocked ? '#157d75' : '#95c2d3';
    ctx.beginPath(); ctx.arc(EXIT.x + 42, y + 85, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e2fff0';
    ctx.textAlign = 'center';
    ctx.font = '800 12px system-ui';
    ctx.fillText(this.levelIndex === 0 ? 'СТАНЦИЯ' : 'БАЗА', x + 75, y + 19);
    roundedRect(ctx, x + 60, y - 22, 29, 17, 4, '#2b6777');
    const pulse = 0.6 + Math.sin(this.elapsed * 4) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.shadowBlur = 19; ctx.shadowColor = '#ffec9e';
    roundedRect(ctx, x + 70, y - 18, 10, 10, 4, '#ffeaa0');
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  drawExplorer(ctx) {
    const p = this.player;
    const x = p.x + p.w / 2;
    const y = p.y;
    const stride = p.onGround ? Math.sin(p.walkCycle) * 4 : 2;
    ctx.save();
    ctx.translate(x, y);
    // Тень под персонажем.
    ctx.fillStyle = '#0b385365';
    ctx.beginPath(); ctx.ellipse(0, p.h + 1, 17, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Ботинки и ходьба.
    roundedRect(ctx, -13, 36 + stride, 11, 9, 3, '#172c49');
    roundedRect(ctx, 3, 36 - stride, 11, 9, 3, '#172c49');
    roundedRect(ctx, -15, 42 + stride, 14, 5, 2, '#c5e6e8');
    roundedRect(ctx, 2, 42 - stride, 15, 5, 2, '#c5e6e8');
    // Рюкзак.
    roundedRect(ctx, p.facing === 1 ? -20 : 9, 18, 11, 22, 4, '#e6a25a', '#ffcf89');
    // Куртка и рукава.
    roundedRect(ctx, -13, 18, 26, 24, 6, '#e89b50', '#ffc17b');
    roundedRect(ctx, p.facing === 1 ? 10 : -18, 21, 8, 17, 4, '#c16f42');
    roundedRect(ctx, -3, 20, 6, 21, 2, '#f6c084');
    // Меховой капюшон и лицо.
    ctx.fillStyle = '#f3ede0';
    ctx.beginPath(); ctx.ellipse(0, 15, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9b99a';
    ctx.beginPath(); ctx.ellipse(0, 15, 11, 12, 0, 0, Math.PI * 2); ctx.fill();
    roundedRect(ctx, -15, 0, 30, 10, 5, '#e79b56', '#ffcb87');
    roundedRect(ctx, -10, -5, 20, 10, 5, '#e2a45c');
    ctx.fillStyle = '#203849';
    ctx.beginPath(); ctx.arc(p.facing === 1 ? 5 : -5, 14, 2, 0, Math.PI * 2); ctx.fill();
    // Шарф.
    roundedRect(ctx, -13, 23, 26, 7, 3, '#73e6d2');
    ctx.restore();
  }

  drawSnow(ctx) {
    const storm = this.levelIndex === 1;
    for (const flake of this.snow) {
      const x = (flake.x + this.elapsed * flake.speed * (storm ? 1.9 : 0.4)) % VIEW_W;
      const y = (flake.y + this.elapsed * flake.speed * (storm ? 1.35 : 1)) % VIEW_H;
      if (storm) {
        ctx.strokeStyle = '#e1f0ff9a';
        ctx.lineWidth = flake.r * 0.8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 11, y + 4); ctx.stroke();
      } else {
        ctx.fillStyle = '#e6ffff6e';
        ctx.beginPath(); ctx.arc(x, y, flake.r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawNotice(ctx) {
    if (this.noticeTimer <= 0) return;
    ctx.save();
    ctx.font = '700 17px system-ui';
    ctx.textAlign = 'center';
    const width = Math.min(460, ctx.measureText(this.notice).width + 50);
    roundedRect(ctx, (VIEW_W - width) / 2, 60, width, 48, 12, '#0b273ce6', '#91d7cc');
    ctx.fillStyle = '#dbfff2';
    ctx.fillText(this.notice, VIEW_W / 2, 90);
    ctx.restore();
  }
}
