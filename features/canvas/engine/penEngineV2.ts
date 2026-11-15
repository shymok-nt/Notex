/** Platform-independent pen engine primitives. Legacy stroke renderers are intentionally untouched. */
export type PointerKind = 'pen' | 'touch' | 'mouse' | 'unknown';
export type InputSample = {
  x: number; y: number; pressure: number; tiltX: number; tiltY: number;
  twist: number; t: number; pointerType: PointerKind; buttons: number;
};
export type BrushId = 'fountain' | 'ballpoint' | 'pencil' | 'highlighter' | 'calligraphy';
export type PressurePreset = 'soft' | 'normal' | 'hard' | 'linear';
export type BrushSnapshot = {
  id: BrushId; size: number; minSizeRatio: number; maxSizeRatio: number;
  opacity: number; flow: number; taperStart: number; taperEnd: number;
  stabilization: number; pressurePreset: PressurePreset;
  pressureThreshold: number; tiltSensitivity: number;
  simulatePressure: boolean; nib: 'round' | 'flat';
};
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
export const defaultBrush = (id: BrushId = 'fountain'): BrushSnapshot => ({
  id, size: id === 'highlighter' ? 14 : 3, minSizeRatio: id === 'ballpoint' ? .9 : .3,
  maxSizeRatio: 1, opacity: id === 'highlighter' ? .35 : 1, flow: 1,
  taperStart: 0, taperEnd: 0, stabilization: 35, pressurePreset: 'normal',
  pressureThreshold: 0, tiltSensitivity: id === 'pencil' ? .5 : 0,
  simulatePressure: false, nib: id === 'highlighter' || id === 'calligraphy' ? 'flat' : 'round',
});
export const normalizeSample = (s: Partial<InputSample> & Pick<InputSample, 'x' | 'y'>): InputSample => ({
  x: s.x, y: s.y, pressure: clamp(s.pressure ?? .5),
  tiltX: clamp(s.tiltX ?? 0, -90, 90), tiltY: clamp(s.tiltY ?? 0, -90, 90),
  twist: ((s.twist ?? 0) % 360 + 360) % 360, t: s.t ?? 0,
  pointerType: s.pointerType ?? 'unknown', buttons: s.buttons ?? 0,
});
export function pressureValue(pressure: number, preset: PressurePreset, threshold = 0): number {
  const p = clamp((clamp(pressure) - clamp(threshold)) / Math.max(.00001, 1 - clamp(threshold)));
  if (preset === 'soft') return Math.pow(p, .6);
  if (preset === 'hard') return Math.pow(p, 1.8);
  return p;
}
export function widthAt(sample: InputSample, brush: BrushSnapshot): number {
  const p = pressureValue(sample.pressure, brush.pressurePreset, brush.pressureThreshold);
  return brush.size * (brush.minSizeRatio + (brush.maxSizeRatio - brush.minSizeRatio) * p);
}
/** Keep the existing stroke.points stride of three; aux is independently optional. */
export function encodeSamples(samples: readonly InputSample[]): { points: number[]; aux: number[] } {
  const points: number[] = [], aux: number[] = [];
  for (const s of samples) {
    points.push(s.x, s.y, s.pressure);
    aux.push(s.tiltX, s.tiltY, s.t);
  }
  return { points, aux };
}
/** Pressure/tilt-aware RDP; never removes endpoints or a pressure inflection. */
export function simplifySamples(samples: readonly InputSample[], spatial = .12, pressure = .015, tilt = 2): InputSample[] {
  if (samples.length <= 2) return samples.slice();
  const keep = new Set<number>([0, samples.length - 1]);
  const stack: Array<[number, number]> = [[0, samples.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const start = samples[a], end = samples[b];
    const dx = end.x - start.x, dy = end.y - start.y, d2 = dx * dx + dy * dy;
    let best = 0, bestIndex = -1;
    for (let i = a + 1; i < b; i++) {
      const p = samples[i];
      const fraction = d2 ? clamp(((p.x - start.x) * dx + (p.y - start.y) * dy) / d2) : (i - a) / (b - a);
      const px = start.x + fraction * dx, py = start.y + fraction * dy;
      const geometric = Math.hypot(p.x - px, p.y - py) / Math.max(.00001, spatial);
      const pressureError = Math.abs(p.pressure - (start.pressure + fraction * (end.pressure - start.pressure))) / Math.max(.00001, pressure);
      const tiltError = Math.max(
        Math.abs(p.tiltX - (start.tiltX + fraction * (end.tiltX - start.tiltX))),
        Math.abs(p.tiltY - (start.tiltY + fraction * (end.tiltY - start.tiltY)))
      ) / Math.max(.00001, tilt);
      const error = Math.max(geometric, pressureError, tiltError);
      if (error > best) { best = error; bestIndex = i; }
    }
    if (best > 1 && bestIndex !== -1) {
      keep.add(bestIndex); stack.push([a, bestIndex], [bestIndex, b]);
    }
  }
  return [...keep].sort((a, b) => a - b).map(i => samples[i]);
}
export function detectPressure(samples: readonly InputSample[]): boolean {
  const pen = samples.filter(s => s.pointerType === 'pen' && s.pressure > 0);
  if (pen.length < 5) return false;
  const min = Math.min(...pen.map(s => s.pressure));
  const max = Math.max(...pen.map(s => s.pressure));
  return max - min > .035;
}
/** Predictions are never accepted by this persistent collector. */
export class PenCollector {
  private samples: InputSample[] = [];
  addReal(sample: InputSample) { this.samples.push(normalizeSample(sample)); }
  finish() { const result = this.samples; this.samples = []; return result; }
  cancel() { this.samples = []; }
  get length() { return this.samples.length; }
}
