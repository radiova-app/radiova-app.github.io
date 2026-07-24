/*
Stateless canvas rendering functions.
Each function takes a CanvasRenderingContext2D as a parameter and reads
canvas dimensions from its backing element. No shared state.

Drawing is best-effort: null contexts, missing canvases, or silent
analyser data result in a static placeholder. A draw failure must never
interfere with audio playback — the visualizer is purely cosmetic.

Geometry safety: all radius, dimension, and position calculations must
produce finite non-negative values before reaching Canvas 2D methods.
Responsive layout may produce tiny or not-yet-sized canvases during
ResizeObserver callbacks; these must be handled gracefully.
*/

/**
 * Minimum side-visualizer dimension below which drawing is skipped.
 * Prevents negative-radius arc errors when layout has not settled.
 */
export const MIN_SIDE_VISUALIZER_SIZE = 16;

/**
 * Return a finite, non-negative radius safe for CanvasRenderingContext2D.arc().
 * @param value - Raw calculated radius.
 * @returns A finite radius >= 0.
 */
export function clampCanvasRadius(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Resize a canvas backing store to match its CSS display size.
 * Accounts for devicePixelRatio.
 * Skips detached canvases to avoid ResizeObserver lifecycle issues.
 * @param canvas - The canvas element to resize.
 */
export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  if (!canvas.isConnected) return;
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

/**
 * Get a 2D rendering context from a canvas element.
 * Returns null when canvas is null or getContext('2d') fails.
 * @param canvas - The canvas element, or null.
 * @returns The 2D context, or null.
 */
export function getCtx(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  return canvas.getContext('2d') || null;
}

/**
 * Draw frequency bars on a canvas context.
 * Falls back to static bars when all data values are zero.
 * @param c - The canvas rendering context.
 * @param dataArray - Frequency data from an AnalyserNode.
 * @param bufferLength - The number of frequency bins.
 * @param growFromTop - when true, bars grow downward from the top edge.
 */
export function drawBars(
  c: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  bufferLength: number,
  growFromTop: boolean,
): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#080e1f';
  c.fillRect(0, 0, w, h);
  if (w <= 0 || h <= 0) return;
  const barCount = Math.min(bufferLength, 64);
  if (!dataArray.some((value) => value > 0)) {
    drawStaticCanvas(c);
    return;
  }
  const barWidth = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const value = dataArray[i] ?? 0;
    const pct = Math.max(0, Math.min(1, value / 255));
    const barH = Math.max(2, pct * (h - 3));
    const x = i * barWidth;
    const y = growFromTop ? 0 : h - barH;
    const gradient = c.createLinearGradient(0, growFromTop ? 0 : y, 0, growFromTop ? barH : h);
    gradient.addColorStop(0, '#f79a42');
    gradient.addColorStop(1, '#34d399');
    c.fillStyle = gradient;
    c.fillRect(x + 0.7, y, Math.max(1.5, barWidth - 1.4), barH);
  }
}

/**
 * Draw a static radial placeholder on the side visualiser canvas.
 * Safe for tiny or not-yet-sized canvases — radius is clamped and
 * arcs are skipped when the available space is below the minimum.
 * @param c - The canvas rendering context.
 */
export function drawSideStatic(c: CanvasRenderingContext2D): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#060c1a';
  c.fillRect(0, 0, w, h);
  if (w < MIN_SIDE_VISUALIZER_SIZE || h < MIN_SIDE_VISUALIZER_SIZE) return;
  const cx = w / 2;
  const cy = h / 2;
  const rMax = clampCanvasRadius(Math.min(cx, cy) - 4);
  if (rMax <= 0) return;
  for (let i = 0; i < 12; i++) {
    const r = Math.max(0, rMax * (1 - i / 12));
    if (r <= 0) continue;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(31, 42, 68, 0.4)';
    c.lineWidth = 1;
    c.stroke();
  }
}

/**
 * Draw a radial frequency visualiser on a canvas context.
 * Falls back to drawSideStatic when all data values are zero.
 * @param c - The canvas rendering context.
 * @param dataArray - Frequency data from an AnalyserNode.
 */
export function drawSide(c: CanvasRenderingContext2D, dataArray: Uint8Array): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#060c1a';
  c.fillRect(0, 0, w, h);
  if (!dataArray.some((v) => v > 0)) { drawSideStatic(c); return; }
  const cx = w / 2;
  const cy = h / 2;
  if (w < MIN_SIDE_VISUALIZER_SIZE || h < MIN_SIDE_VISUALIZER_SIZE) return;
  const barCount = 64;
  const angleStep = (Math.PI * 2) / barCount;
  const available = Math.max(0, Math.min(cx, cy));
  for (let i = 0; i < barCount; i++) {
    const value = dataArray[i] ?? 0;
    const pct = Math.max(0.08, value / 255);
    const rIn = Math.max(0, available * 0.15);
    const rOut = Math.max(0, rIn + (available - rIn - 4) * pct);
    const angle = angleStep * i - Math.PI / 2;
    const x1 = cx + rIn * Math.cos(angle);
    const y1 = cy + rIn * Math.sin(angle);
    const x2 = cx + rOut * Math.cos(angle);
    const y2 = cy + rOut * Math.sin(angle);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = 'hsl(' + String(25 + i * 0.8) + ', 85%, ' + String(50 + pct * 30) + '%)';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.stroke();
  }
}

/**
 * Draw a static placeholder with short horizontal bars.
 * Used when no frequency data is available (paused, loading, error).
 * @param c - The canvas rendering context.
 * @param growFromTop - when true, bars sit at the top edge.
 */
export function drawStaticCanvas(c: CanvasRenderingContext2D, growFromTop = false): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#080e1f';
  c.fillRect(0, 0, w, h);
  if (w <= 0 || h <= 0) return;
  const barCount = 32;
  const barWidth = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const x = i * barWidth;
    c.fillStyle = '#1f2a44';
    c.fillRect(x + 0.7, growFromTop ? 0 : h - 3, Math.max(1.5, barWidth - 1.4), 3);
  }
}
