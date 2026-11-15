import type {Bounds, StrokeElement, TextElement} from '../types';

/** Persistent text-box representation for the replacement editor. */
export type TextBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  createdAt: string;
  zIndex: number;
};

export type PageItemGeometry = {id: string; x: number; y: number; bbox: Bounds; zIndex: number};

export const MIN_TEXT_WIDTH = 40;
export const MIN_TEXT_HEIGHT = 24;

export function textBoxBounds(box: Pick<TextBox, 'x'|'y'|'width'|'height'>): Bounds {
  return [box.x, box.y, box.x + box.width, box.y + box.height];
}

export function strokeBounds(stroke: StrokeElement): Bounds {
  return stroke.bbox;
}

export function pageItemGeometry(item: TextBox | StrokeElement): PageItemGeometry {
  if ('points' in item) {
    return {id: item.id, x: item.bbox[0], y: item.bbox[1], bbox: strokeBounds(item), zIndex: item.z};
  }
  return {id: item.id, x: item.x, y: item.y, bbox: textBoxBounds(item), zIndex: item.zIndex};
}

/** Preserve existing notes while moving away from the old text element layout. */
export function legacyTextToBox(element: TextElement): TextBox {
  return {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.w,
    height: Math.max(MIN_TEXT_HEIGHT, element.bbox[3] - element.bbox[1]),
    text: element.text,
    fontSize: element.fontSize,
    fontFamily: element.fontFamily ?? 'Inter',
    color: element.color,
    bold: element.bold,
    italic: element.italic ?? false,
    underline: element.underline ?? false,
    align: element.align,
    createdAt: element.createdAt,
    zIndex: element.z
  };
}

export function normalizeTextBox(box: TextBox, pageWidth: number, pageHeight: number): TextBox {
  const width = Math.max(MIN_TEXT_WIDTH, Math.min(pageWidth, Number.isFinite(box.width) ? box.width : MIN_TEXT_WIDTH));
  const height = Math.max(MIN_TEXT_HEIGHT, Math.min(pageHeight, Number.isFinite(box.height) ? box.height : MIN_TEXT_HEIGHT));
  return {
    ...box,
    width,
    height,
    x: Math.max(0, Math.min(pageWidth - width, Number.isFinite(box.x) ? box.x : 0)),
    y: Math.max(0, Math.min(pageHeight - height, Number.isFinite(box.y) ? box.y : 0))
  };
}

export type ResizeHandle = 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw';

/** Resize in page coordinates. Corner handles preserve the starting aspect ratio. */
export function resizeTextBox(
  box: TextBox, handle: ResizeHandle, dx: number, dy: number,
  pageWidth: number, pageHeight: number
): TextBox {
  const right = box.x + box.width, bottom = box.y + box.height;
  let left = box.x, top = box.y, newRight = right, newBottom = bottom;
  if (handle.includes('w')) left += dx;
  if (handle.includes('e')) newRight += dx;
  if (handle.includes('n')) top += dy;
  if (handle.includes('s')) newBottom += dy;
  if (handle.length === 2) {
    const aspect = box.width / Math.max(1, box.height);
    const proposedW = newRight - left, proposedH = newBottom - top;
    if (Math.abs(proposedW - box.width) / box.width >= Math.abs(proposedH - box.height) / box.height) {
      const h = proposedW / aspect;
      if (handle.includes('n')) top = bottom - h;
      else newBottom = box.y + h;
    } else {
      const w = proposedH * aspect;
      if (handle.includes('w')) left = right - w;
      else newRight = box.x + w;
    }
  }
  if (newRight - left < MIN_TEXT_WIDTH) {
    if (handle.includes('w')) left = newRight - MIN_TEXT_WIDTH;
    else newRight = left + MIN_TEXT_WIDTH;
  }
  if (newBottom - top < MIN_TEXT_HEIGHT) {
    if (handle.includes('n')) top = newBottom - MIN_TEXT_HEIGHT;
    else newBottom = top + MIN_TEXT_HEIGHT;
  }
  left = Math.max(0, left); top = Math.max(0, top);
  newRight = Math.min(pageWidth, newRight); newBottom = Math.min(pageHeight, newBottom);
  return normalizeTextBox({...box, x: left, y: top, width: newRight - left, height: newBottom - top}, pageWidth, pageHeight);
}
