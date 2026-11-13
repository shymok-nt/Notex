const SOURCE_WIDTH = 600;
const SOURCE_HEIGHT = 800;

export function fitSpecialCoverImage(width: number, height: number) {
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);
  const scale = Math.min(safeWidth / SOURCE_WIDTH, safeHeight / SOURCE_HEIGHT);
  return { width: SOURCE_WIDTH * scale, height: SOURCE_HEIGHT * scale };
}

