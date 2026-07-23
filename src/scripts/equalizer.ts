export type EqMode = 'real-stereo' | 'mono-fallback' | 'cors-blocked' | 'unavailable' | 'paused';

export interface EqualizerHandle {
  start: () => void;
  stop: () => void;
  setAudioElement: (el: HTMLAudioElement | null) => void;
  resize: () => void;
  rebindCanvases: (left: HTMLCanvasElement | null, right: HTMLCanvasElement | null) => void;
  destroy: () => void;
  prepare: () => void;
  getMode: () => EqMode;
}

export interface SideVisualizerHandle {
  setAudioElement: (el: HTMLAudioElement | null) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

// Persistent audio graph (created once, survives navigation)
let audioCtx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;
let splitter: ChannelSplitterNode | null = null;
let analyserL: AnalyserNode | null = null;
let analyserR: AnalyserNode | null = null;
let graphConnected = false;
let graphAudioElement: HTMLAudioElement | null = null;
let eqMode: EqMode = 'unavailable';
let modeLogged = false;

// View state (rebound per navigation)
let canvasLeft: HTMLCanvasElement | null = null;
let canvasRight: HTMLCanvasElement | null = null;
let ctxLeft: CanvasRenderingContext2D | null = null;
let ctxRight: CanvasRenderingContext2D | null = null;
let canvasSide: HTMLCanvasElement | null = null;
let ctxSide: CanvasRenderingContext2D | null = null;

let isActive = false;
let reducedMotion = false;
let animFrameId: number | null = null;

function logMode(mode: EqMode): void {
  if (modeLogged) return;
  modeLogged = true;
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isDev) console.log('equalizer mode: ' + mode);
}

function ensureAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function resumeAudioContext(): Promise<void> {
  const ctx = audioCtx;
  if (ctx && ctx.state === 'suspended') {
    return ctx.resume().then(() => undefined).catch(() => undefined);
  }
  return Promise.resolve();
}

function getCtx(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
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
  if (!isActive) {
    drawStatic();
    return;
  }

  if (eqMode === 'paused' || eqMode === 'cors-blocked' || eqMode === 'unavailable') {
    drawStatic();
    animFrameId = requestAnimationFrame(tick);
    return;
  }

  const bufferLength = (analyserL?.frequencyBinCount ?? 0);
  if (!bufferLength) {
    drawStatic();
    animFrameId = requestAnimationFrame(tick);
    return;
  }

  const dataL = new Uint8Array(bufferLength);
  const dataR = new Uint8Array(bufferLength);
  if (analyserL) analyserL.getByteFrequencyData(dataL);
  if (analyserR) analyserR.getByteFrequencyData(dataR);

  const hasDataL = dataL.some((v) => v > 0);
  const hasDataR = dataR.some((v) => v > 0);

  if (eqMode === 'mono-fallback') {
    if (ctxLeft && canvasLeft) drawBars(ctxLeft, dataL, bufferLength, false);
    if (ctxRight && canvasRight) drawBars(ctxRight, dataL, bufferLength, true);
  } else {
    if (ctxLeft && canvasLeft) drawBars(ctxLeft, dataL, bufferLength, false);
    if (ctxRight && canvasRight) drawBars(ctxRight, dataR, bufferLength, true);
  }

  if (ctxSide && canvasSide) drawSide(ctxSide, dataL);

  if (!hasDataL && !hasDataR) {
    classifyMode();
  }

  animFrameId = requestAnimationFrame(tick);
}

function classifyMode(): void {
  if (!audioCtx || !graphConnected) {
    eqMode = 'unavailable';
  } else {
    eqMode = 'cors-blocked';
  }
  logMode(eqMode);
}

function ensureGraph(audioEl: HTMLAudioElement): boolean {
  if (graphConnected && source && source.mediaElement === audioEl) return true;
  try {
    if (!audioCtx) {
      audioCtx = ensureAudioContext();
    }
    if (!audioCtx) { eqMode = 'unavailable'; return false; }

    source = audioCtx.createMediaElementSource(audioEl);
    splitter = audioCtx.createChannelSplitter(2);
    analyserL = audioCtx.createAnalyser();
    analyserR = audioCtx.createAnalyser();
    analyserL.fftSize = 128;
    analyserR.fftSize = 128;

    source.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    analyserL.connect(audioCtx.destination);
    analyserR.connect(audioCtx.destination);

    graphConnected = true;
    graphAudioElement = audioEl;
    eqMode = 'real-stereo';
    modeLogged = false;
    logMode(eqMode);
    return true;
  } catch {
    source = null;
    splitter = null;
    analyserL = null;
    analyserR = null;
    graphConnected = false;
    eqMode = 'cors-blocked';
    logMode(eqMode);
    return false;
  }
}

function clearGraph(): void {
  if (source) { try { source.disconnect(); } catch { /* ignore */ } source = null; }
  if (splitter) { try { splitter.disconnect(); } catch { /* ignore */ } splitter = null; }
  if (analyserL) { try { analyserL.disconnect(); } catch { /* ignore */ } analyserL = null; }
  if (analyserR) { try { analyserR.disconnect(); } catch { /* ignore */ } analyserR = null; }
  graphConnected = false;
  graphAudioElement = null;
  eqMode = 'unavailable';
  modeLogged = false;
}

function destroyGraph(): void {
  stopAnimation();
  clearGraph();
  if (audioCtx) { void audioCtx.close(); audioCtx = null; }
}

function stopAnimation(): void {
  isActive = false;
  if (animFrameId !== null) { cancelAnimationFrame(animFrameId); animFrameId = null; }
}

export function createSideVisualizer(canvasEl: HTMLCanvasElement): SideVisualizerHandle {
  canvasSide = canvasEl;
  ctxSide = getCtx(canvasSide);
  if (ctxSide) drawSideStatic(ctxSide);

  return {
    setAudioElement(el: HTMLAudioElement | null): void {
      if (el && isActive) ensureGraph(el);
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
  ctxLeft = getCtx(canvasLeft);
  ctxRight = getCtx(canvasRight);
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handle: EqualizerHandle = {
    prepare(): void {
      void resumeAudioContext();
    },

    getMode(): EqMode {
      return eqMode;
    },

    start(): void {
      if (isActive) return;
      isActive = true;
      if (reducedMotion) return;
      if (graphAudioElement && !graphConnected) {
        ensureGraph(graphAudioElement);
      }
      if (eqMode === 'unavailable') {
        classifyMode();
      }
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(tick);
    },

    stop(): void {
      isActive = false;
      eqMode = 'paused';
      drawStatic();
      if (animFrameId !== null) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    },

    setAudioElement(el: HTMLAudioElement | null): void {
      if (!el) return;
      if (graphConnected && graphAudioElement === el) return;
      graphAudioElement = el;
      if (isActive && !graphConnected) ensureGraph(el);
    },

    rebindCanvases(left: HTMLCanvasElement | null, right: HTMLCanvasElement | null): void {
      canvasLeft = left;
      canvasRight = right;
      ctxLeft = left ? getCtx(left) : null;
      ctxRight = right ? getCtx(right) : null;
      drawStatic();
    },

    resize(): void { drawStatic(); },

    destroy(): void {
      destroyGraph();
      canvasLeft = null;
      canvasRight = null;
      ctxLeft = null;
      ctxRight = null;
      graphAudioElement = null;
    },
  };

  drawStatic();
  return handle;
}
