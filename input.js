// Клавиатура и экранные кнопки. Для прыжка используется событие нажатия,
// а не удержание: автопрыжков при приземлении нет.
const MOVE_LEFT = new Set(['arrowleft', 'a', 'ф']);
const MOVE_RIGHT = new Set(['arrowright', 'd', 'в']);
const JUMP = new Set([' ', 'w', 'ц', 'arrowup']);
const PAUSE = new Set(['escape', 'p', 'з']);

export class Input {
  constructor({ isActive, onPause }) {
    this.isActive = isActive;
    this.onPause = onPause;
    this.held = new Set();
    this.touch = { left: false, right: false, jump: false };
    this.jumpRequested = false;

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      const gameKey = MOVE_LEFT.has(key) || MOVE_RIGHT.has(key) || JUMP.has(key);
      if (gameKey && this.isActive()) event.preventDefault();
      if (PAUSE.has(key) && !event.repeat) {
        if (this.isActive()) event.preventDefault();
        this.onPause();
      }
      if (JUMP.has(key) && !this.held.has(key) && this.isActive()) {
        this.jumpRequested = true;
      }
      this.held.add(key);
    });

    window.addEventListener('keyup', (event) => {
      this.held.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.clear());

    document.querySelectorAll('[data-control]').forEach((button) => {
      const control = button.dataset.control;
      button.addEventListener('pointerdown', (event) => {
        if (!this.isActive()) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        if (control === 'jump' && !this.touch.jump) this.jumpRequested = true;
        this.touch[control] = true;
        button.classList.add('pressed');
      });
      const release = () => {
        this.touch[control] = false;
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  }

  direction() {
    const left = this.touch.left || [...MOVE_LEFT].some((key) => this.held.has(key));
    const right = this.touch.right || [...MOVE_RIGHT].some((key) => this.held.has(key));
    return Number(right) - Number(left);
  }

  consumeJump() {
    const request = this.jumpRequested;
    this.jumpRequested = false;
    return request;
  }

  clear() {
    this.held.clear();
    this.touch.left = this.touch.right = this.touch.jump = false;
    this.jumpRequested = false;
    document.querySelectorAll('[data-control]').forEach((button) => {
      button.classList.remove('pressed');
    });
  }
}
