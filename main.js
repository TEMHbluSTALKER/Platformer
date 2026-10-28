import { Game } from './Game.js';
import { Input } from './input.js';

const $ = (id) => document.getElementById(id);
const startButton = $('start-btn');
const pauseButton = $('pause-btn');
const restartButton = $('restart-btn');
const overlay = $('overlay');
const overlayAction = $('overlay-action');

function updateHud(info) {
  $('items-count').textContent = `${info.collected} / ${info.total}`;
  $('score').textContent = info.score;
  $('time').textContent = info.time;
  $('best').textContent = info.best;
  $('level-number').textContent = `УРОВЕНЬ ${info.level} / ${info.levelCount}`;
  $('world-label').textContent = info.level === 1 ? 'СЕКТОР 07 · ЛЕДЯНОЙ МАРШРУТ' : 'СЕКТОР 08 · СНЕЖНАЯ БУРЯ';
}

function updateState(info) {
  const state = info.state;
  overlay.classList.toggle('hidden', state === 'playing');
  overlay.dataset.state = state;
  overlayAction.disabled = state === 'playing';
  $('status-dot').className = `status-dot ${state === 'playing' ? 'playing' : ['won', 'lost', 'level-complete'].includes(state) ? 'ended' : ''}`;
  $('state-label').textContent = {
    ready: 'ОЖИДАНИЕ', playing: 'В ПУТИ', paused: 'ПАУЗА', 'level-complete': 'УРОВЕНЬ ПРОЙДЕН', won: 'ПОБЕДА', lost: 'ПОРАЖЕНИЕ',
  }[state];

  startButton.disabled = state === 'playing';
  pauseButton.disabled = state !== 'playing' && state !== 'paused';
  pauseButton.querySelector('span').textContent = state === 'paused' ? 'Продолжить' : 'Пауза';
  startButton.querySelector('span').textContent = {
    ready: 'Начать игру', paused: 'Продолжить', playing: 'Идёт игра',
    'level-complete': 'Следующий уровень', lost: 'Повторить уровень', won: 'Играть снова',
  }[state];

  const screens = {
    ready: ['ЗАДАНИЕ ЭКСПЕДИЦИИ', 'Добро пожаловать в Арктику',
      'Впереди 2 уровня: ледяной маршрут и снежная буря. На каждом соберите 3 кристалла, избегайте воды и разломов.',
      'Начать игру'],
    paused: [`УРОВЕНЬ ${info.level} ИЗ ${info.levelCount}`, 'Пауза',
      `Собрано ${info.collected} из ${info.total} кристаллов. Время остановлено.`,
      'Продолжить'],
    'level-complete': ['ПЕРВЫЙ РУБЕЖ ПРОЙДЕН', 'Уровень 1 завершён!',
      `Все кристаллы собраны. Очки: ${info.score}. Впереди снежная буря, новая карта и дополнительные разломы.`,
      'Следующий уровень'],
    won: ['ОБА УРОВНЯ ПРОЙДЕНЫ', 'Экспедиция завершена!',
      `Вы собрали все 6 кристаллов за ${info.time}. Итог: ${info.score} очков. Рекорд: ${info.best}.`,
      'Играть снова'],
    lost: [`СИГНАЛ ПОТЕРЯН · УРОВЕНЬ ${info.level}`, 'Экспедиция прервана',
      `Опасная зона! Собрано ${info.collected} из ${info.total} кристаллов на этом уровне.`,
      'Повторить уровень'],
  };
  if (screens[state]) {
    const [kicker, title, description, action] = screens[state];
    $('overlay-kicker').textContent = kicker;
    $('overlay-title').textContent = title;
    $('overlay-text').textContent = description;
    $('overlay-action-text').textContent = action;
  }
}

export const game = new Game($('game'), {
  onStateChange: updateState,
  onHudChange: updateHud,
});
const input = new Input({
  isActive: () => game.state === 'playing',
  onPause: () => game.togglePause(),
});
game.setInput(input);

startButton.addEventListener('click', () => game.start());
overlayAction.addEventListener('click', () => game.start());
pauseButton.addEventListener('click', () => game.togglePause());
restartButton.addEventListener('click', () => game.restart());

game.begin();
