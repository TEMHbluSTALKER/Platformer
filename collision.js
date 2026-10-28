// Общие геометрические функции. У прямоугольников координаты левого верхнего угла.
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// Подбор предмета: достаточно приблизиться прямоугольником игрока к центру кристалла.
export function circleTouchesRect(cx, cy, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return (cx - nearestX) ** 2 + (cy - nearestY) ** 2 <= radius ** 2;
}
