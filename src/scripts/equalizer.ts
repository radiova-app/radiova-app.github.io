export interface EqualizerHandle {
  start: () => void;
  stop: () => void;
  setAudioElement: (el: HTMLAudioElement | null) => void;
  resize: () => void;
  destroy: () => void;
}

export interface SideVisualizerHandle {
  setAudioElement: (el: HTMLAudioElement | null) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

let audioCtx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let canvasLeft: HTMLCanvasElement | null = null;
let canvasRight: HTMLCanvasElement | null = null;
let ctxLeft: CanvasRenderingContext2D | null = null;
let ctxRight: CanvasRenderingContext2D | null = null;
let canvasSide: HTMLCanvasElement | null = null;
let ctxSide: CanvasRenderingContext2D | null = null;
let currentAudio: HTMLAudioElement | null = null;
let isActive = false;
let reducedMotion = false;

function getCtx(canvas: HTMLCanvasElement | null, prev: CanvasRenderingContext2D | null): CanvasRenderingContext2D | null {
  if (prev) return prev;
  if (!canvas) return null;
  return canvas.getContext('2d') || null;
}

function drawBars(c: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number, mirrorY: boolean): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#080e1f';
  c.fillRect(0, 0, w, h);

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
    const y = mirrorY ? 0 : h - barH;
    const gradient = c.createLinearGradient(0, mirrorY ? 0 : y, 0, mirrorY ? barH : h);
    gradient.addColorStop(0, '#f79a42');
    gradient.addColorStop(1, '#34d399');
    c.fillStyle = gradient;
    c.fillRect(x + 0.7, y, Math.max(1.5, barWidth - 1.4), barH);
  }
}

function drawSideStatic(c: CanvasRenderingContext2D): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#060c1a';
  c.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const rMax = Math.min(cx, cy) - 4;
  for (let i = 0; i < 12; i++) {
    const r = rMax * (1 - i / 12);
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(31, 42, 68, 0.4)';
    c.lineWidth = 1;
    c.stroke();
  }
}

function drawSide(c: CanvasRenderingContext2D, dataArray: Uint8Array): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#060c1a';
  c.fillRect(0, 0, w, h);
  if (!dataArray.some((v) => v > 0)) { drawSideStatic(c); return; }
  const cx = w / 2;
  const cy = h / 2;
  const barCount = 64;
  const angleStep = (Math.PI * 2) / barCount;
  for (let i = 0; i < barCount; i++) {
    const value = dataArray[i] ?? 0;
    const pct = Math.max(0.08, value / 255);
    const rIn = Math.min(cx, cy) * 0.15;
    const rOut = rIn + (Math.min(cx, cy) - rIn - 4) * pct;
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

function drawStatic(): void {
  if (ctxLeft && canvasLeft) drawStaticCanvas(ctxLeft);
  if (ctxRight && canvasRight) drawStaticCanvas(ctxRight);
  if (ctxSide && canvasSide) drawSideStatic(ctxSide);
}

function drawStaticCanvas(c: CanvasRenderingContext2D): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#080e1f';
  c.fillRect(0, 0, w, h);
  const barCount = 32;
  const barWidth = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const x = i * barWidth;
    c.fillStyle = '#1f2a44';
    c.fillRect(x + 0.7, h - 3, Math.max(1.5, barWidth - 1.4), 3);
  }
}

function tick(): void {
  if (!isActive || !analyser) {
    drawStatic();
    return;
  }
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  if (ctxLeft && canvasLeft) drawBars(ctxLeft, dataArray, bufferLength, false);
  if (ctxRight && canvasRight) drawBars(ctxRight, dataArray, bufferLength, true);
  if (ctxSide && canvasSide) drawSide(ctxSide, dataArray);

  animFrameId = requestAnimationFrame(tick);
}

let animFrameId: number | null = null;

function setupAudioGraph(audioEl: HTMLAudioElement): boolean {
  try {
    if (source && source.mediaElement === audioEl) return true;
    cleanupGraph();
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    source = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    return true;
  } catch {
    source = null;
    analyser = null;
    return false;
  }
}

function cleanupGraph(): void {
  if (source) { try { source.disconnect(); } catch { /* ignore */ } source = null; }
  if (analyser) { try { analyser.disconnect(); } catch { /* ignore */ } analyser = null; }
}

export function createSideVisualizer(canvasEl: HTMLCanvasElement): SideVisualizerHandle {
  canvasSide = canvasEl;
  ctxSide = getCtx(canvasSide, ctxSide);
  if (ctxSide) drawSideStatic(ctxSide);

  return {
    setAudioElement(el: HTMLAudioElement | null): void {
      currentAudio = el;
      if (el && isActive) setupAudioGraph(el);
    },
    start(): void { /* side uses same tick loop */ },
    stop(): void {
      if (ctxSide && canvasSide) drawSideStatic(ctxSide);
    },
    destroy(): void {
      canvasSide = null;
      ctxSide = null;
    },
  };
}

export function createEqualizer(left: HTMLCanvasElement, right: HTMLCanvasElement): EqualizerHandle {
  canvasLeft = left;
  canvasRight = right;
  ctxLeft = getCtx(canvasLeft, ctxLeft);
  ctxRight = getCtx(canvasRight, ctxRight);
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handle: EqualizerHandle = {
    start(): void {
      if (isActive) return;
      isActive = true;
      if (reducedMotion) return;
      if (currentAudio && !analyser) setupAudioGraph(currentAudio);
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(tick);
    },

    stop(): void {
      isActive = false;
      drawStatic();
      if (animFrameId !== null) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    },

    setAudioElement(el: HTMLAudioElement | null): void {
      if (currentAudio === el) return;
      currentAudio = el;
      if (el && isActive) setupAudioGraph(el);
    },

    resize(): void { drawStatic(); },

    destroy(): void {
      handle.stop();
      cleanupGraph();
      if (audioCtx) { void audioCtx.close(); audioCtx = null; }
      canvasLeft = null;
      canvasRight = null;
      ctxLeft = null;
      ctxRight = null;
      currentAudio = null;
    },
  };

  drawStatic();
  return handle;
}
