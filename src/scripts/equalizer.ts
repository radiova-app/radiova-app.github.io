export type EqMode = 'real-stereo' | 'mono-fallback' | 'cors-blocked' | 'unavailable' | 'paused';

export interface EqualizerHandle {
  start: () => void;
  stop: () => void;
  setAudioElement: (el: HTMLAudioElement | null) => void;
  resize: () => void;
  rebindCanvases: (
    top: HTMLCanvasElement | null,
    bottom: HTMLCanvasElement | null,
    side?: HTMLCanvasElement | null,
  ) => void;
  rebindSideCanvas: (side: HTMLCanvasElement | null) => void;
  rebindMeters: (left: HTMLElement | null, right: HTMLElement | null) => void;
  syncWithCurrentPlaybackState: (isPlaying: boolean) => void;
  setCurrentStationId: (stationId: string | null) => void;
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

export interface VisualizerDebugState {
  mode: EqMode;
  audioElement: boolean;
  audioContextState: AudioContextState | 'missing';
  sourceCreated: boolean;
  splitterCreated: boolean;
  mediaElementSourceCount: number;
  gainNodePresent: boolean;
  channelSplitterPresent: boolean;
  leftAnalyserPresent: boolean;
  rightAnalyserPresent: boolean;
  destinationConnected: boolean;
  topCanvasBound: boolean;
  bottomCanvasBound: boolean;
  sideCanvasBound: boolean;
  leftCanvas: boolean;
  rightCanvas: boolean;
  canvasSizes: { top: string | null; bottom: string | null; side: string | null };
  animationLoopCount: number;
  animationFrameActive: boolean;
  leftMax: number;
  rightMax: number;
  topMax: number;
  bottomMax: number;
  sideMax: number;
  leftRms: number;
  rightRms: number;
  leftPeak: number;
  rightPeak: number;
  leftMeterWidth: number;
  rightMeterWidth: number;
  meterElementsBound: boolean;
  currentStationId: string | null;
  audioPaused: boolean | null;
  canvasGeneration: number;
  corsMode: string | null;
  rootCause: string | null;
}

declare global {
  interface Window {
    __radiovaVisualizerDebug?: VisualizerDebugState;
  }
}

interface PersistentVisualizerGraph {
  audioCtx: AudioContext | null;
  source: MediaElementAudioSourceNode | null;
  gainNode: GainNode | null;
  splitter: ChannelSplitterNode | null;
  analyserL: AnalyserNode | null;
  analyserR: AnalyserNode | null;
  connected: boolean;
  destinationConnected: boolean;
  audioElement: HTMLAudioElement | null;
  unloadBound: boolean;
}

interface VisualizerViews {
  topCanvas: HTMLCanvasElement | null;
  bottomCanvas: HTMLCanvasElement | null;
  sideCanvas: HTMLCanvasElement | null;
  topCtx: CanvasRenderingContext2D | null;
  bottomCtx: CanvasRenderingContext2D | null;
  sideCtx: CanvasRenderingContext2D | null;
  leftMeter: HTMLElement | null;
  rightMeter: HTMLElement | null;
  resizeObserver: ResizeObserver | null;
  rafId: number | null;
  canvasGeneration: number;
}

const graph: PersistentVisualizerGraph = {
  audioCtx: null,
  source: null,
  gainNode: null,
  splitter: null,
  analyserL: null,
  analyserR: null,
  connected: false,
  destinationConnected: false,
  audioElement: null,
  unloadBound: false,
};

const views: VisualizerViews = {
  topCanvas: null,
  bottomCanvas: null,
  sideCanvas: null,
  topCtx: null,
  bottomCtx: null,
  sideCtx: null,
  leftMeter: null,
  rightMeter: null,
  resizeObserver: null,
  rafId: null,
  canvasGeneration: 0,
};

let isActive = false;
let meterDecayPending = false;
let reducedMotion = false;
let eqMode: EqMode = 'unavailable';
let modeLogged = false;
let animationLoopCount = 0;
let zeroFrameCount = 0;
let topMax = 0;
let bottomMax = 0;
let sideMax = 0;
let leftRms = 0;
let rightRms = 0;
let leftPeak = 0;
let rightPeak = 0;
let leftMeterWidth = 0;
let rightMeterWidth = 0;
let currentStationId: string | null = null;
let rootCause: string | null = null;

export interface LevelSample {
  rms: number;
  peak: number;
}

function logMode(mode: EqMode): void {
  if (modeLogged) return;
  modeLogged = true;
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isDev) console.log('equalizer mode: ' + mode);
}

function maxBin(dataArray: Uint8Array): number {
  let max = 0;
  for (const value of dataArray) {
    if (value > max) max = value;
  }
  return max;
}

export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calculateLevelFromTimeDomainData(dataArray: Uint8Array): LevelSample {
  if (dataArray.length === 0) return { rms: 0, peak: 0 };
  let sum = 0;
  let peak = 0;
  for (const value of dataArray) {
    const normalized = (value - 128) / 128;
    const abs = Math.abs(normalized);
    sum += normalized * normalized;
    if (abs > peak) peak = abs;
  }
  return {
    rms: clampLevel(Math.sqrt(sum / dataArray.length)),
    peak: clampLevel(peak),
  };
}

export function smoothLevel(current: number, target: number): number {
  const clampedCurrent = clampLevel(current);
  const clampedTarget = clampLevel(target);
  const factor = clampedTarget > clampedCurrent ? 0.55 : 0.12;
  return clampLevel(clampedCurrent + (clampedTarget - clampedCurrent) * factor);
}

function meterTarget(sample: LevelSample): number {
  return clampLevel(Math.max(sample.rms * 2.4, sample.peak * 0.72));
}

function resetMeters(state: 'inactive' | 'loading' | 'playing' | 'paused' | 'error' = 'paused'): void {
  leftRms = 0;
  rightRms = 0;
  leftPeak = 0;
  rightPeak = 0;
  leftMeterWidth = smoothLevel(leftMeterWidth, 0);
  rightMeterWidth = smoothLevel(rightMeterWidth, 0);
  updateMeterElements(state);
}

function metersNeedDecay(): boolean {
  return leftMeterWidth > 0.002 || rightMeterWidth > 0.002;
}

function updateMeterElements(state: 'inactive' | 'loading' | 'playing' | 'paused' | 'error'): void {
  if (views.leftMeter) {
    views.leftMeter.style.width = String(leftMeterWidth * 100) + '%';
    views.leftMeter.dataset['meterState'] = state;
  }
  if (views.rightMeter) {
    views.rightMeter.style.width = String(rightMeterWidth * 100) + '%';
    views.rightMeter.dataset['meterState'] = state;
  }
}

function readAnalyserLevel(analyser: AnalyserNode | null): LevelSample {
  if (!analyser) return { rms: 0, peak: 0 };
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  return calculateLevelFromTimeDomainData(data);
}

function updateDebug(): void {
  window.__radiovaVisualizerDebug = {
    mode: eqMode,
    audioElement: Boolean(graph.audioElement),
    audioContextState: graph.audioCtx?.state ?? 'missing',
    sourceCreated: Boolean(graph.source),
    splitterCreated: Boolean(graph.splitter),
    mediaElementSourceCount: graph.source ? 1 : 0,
    gainNodePresent: Boolean(graph.gainNode),
    channelSplitterPresent: Boolean(graph.splitter),
    leftAnalyserPresent: Boolean(graph.analyserL),
    rightAnalyserPresent: Boolean(graph.analyserR),
    destinationConnected: graph.destinationConnected,
    topCanvasBound: Boolean(views.topCanvas),
    bottomCanvasBound: Boolean(views.bottomCanvas),
    sideCanvasBound: Boolean(views.sideCanvas),
    leftCanvas: Boolean(views.topCanvas),
    rightCanvas: Boolean(views.bottomCanvas),
    canvasSizes: {
      top: views.topCanvas ? String(views.topCanvas.width) + 'x' + String(views.topCanvas.height) : null,
      bottom: views.bottomCanvas ? String(views.bottomCanvas.width) + 'x' + String(views.bottomCanvas.height) : null,
      side: views.sideCanvas ? String(views.sideCanvas.width) + 'x' + String(views.sideCanvas.height) : null,
    },
    animationLoopCount,
    animationFrameActive: views.rafId !== null,
    leftMax: topMax,
    rightMax: bottomMax,
    topMax,
    bottomMax,
    sideMax,
    leftRms,
    rightRms,
    leftPeak,
    rightPeak,
    leftMeterWidth,
    rightMeterWidth,
    meterElementsBound: Boolean(views.leftMeter && views.rightMeter),
    currentStationId,
    audioPaused: graph.audioElement ? graph.audioElement.paused : null,
    canvasGeneration: views.canvasGeneration,
    corsMode: graph.audioElement?.crossOrigin || null,
    rootCause,
  };
}

function ensureAudioContext(): AudioContext | null {
  try {
    if (!graph.audioCtx) {
      graph.audioCtx = new AudioContext();
    }
    if (graph.audioCtx.state === 'suspended') {
      void graph.audioCtx.resume();
    }
    return graph.audioCtx;
  } catch {
    return null;
  }
}

function resumeAudioContext(): Promise<void> {
  const ctx = graph.audioCtx;
  if (ctx && ctx.state === 'suspended') {
    return ctx.resume().then(() => undefined).catch(() => undefined);
  }
  return Promise.resolve();
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function observeCanvases(): void {
  views.resizeObserver?.disconnect();
  views.resizeObserver = null;
  const targets = [views.topCanvas, views.bottomCanvas, views.sideCanvas].filter((canvas): canvas is HTMLCanvasElement => {
    return Boolean(canvas);
  });
  for (const canvas of targets) resizeCanvasToDisplaySize(canvas);
  if (!('ResizeObserver' in window) || targets.length === 0) return;
  views.resizeObserver = new ResizeObserver(() => {
    for (const canvas of targets) resizeCanvasToDisplaySize(canvas);
    drawStatic();
    updateDebug();
  });
  for (const canvas of targets) views.resizeObserver.observe(canvas);
}

function getCtx(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  return canvas.getContext('2d') || null;
}

function drawBars(c: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number, growFromTop: boolean): void {
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
    const y = growFromTop ? 0 : h - barH;
    const gradient = c.createLinearGradient(0, growFromTop ? 0 : y, 0, growFromTop ? barH : h);
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
  if (views.topCtx && views.topCanvas) drawStaticCanvas(views.topCtx, true);
  if (views.bottomCtx && views.bottomCanvas) drawStaticCanvas(views.bottomCtx, false);
  if (views.sideCtx && views.sideCanvas) drawSideStatic(views.sideCtx);
}

function drawStaticCanvas(c: CanvasRenderingContext2D, growFromTop = false): void {
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
    c.fillRect(x + 0.7, growFromTop ? 0 : h - 3, Math.max(1.5, barWidth - 1.4), 3);
  }
}

function tick(): void {
  animationLoopCount += 1;
  if (!isActive) {
    drawStatic();
    if (meterDecayPending) resetMeters();
    updateDebug();
    if (meterDecayPending && metersNeedDecay()) {
      views.rafId = requestAnimationFrame(tick);
    } else {
      meterDecayPending = false;
      views.rafId = null;
    }
    return;
  }

  if (eqMode === 'paused' || eqMode === 'cors-blocked' || eqMode === 'unavailable') {
    drawStatic();
    resetMeters(eqMode === 'paused' ? 'paused' : 'inactive');
    updateDebug();
    views.rafId = requestAnimationFrame(tick);
    return;
  }

  const bufferLength = (graph.analyserL?.frequencyBinCount ?? 0);
  if (!bufferLength) {
    drawStatic();
    resetMeters();
    updateDebug();
    views.rafId = requestAnimationFrame(tick);
    return;
  }

  const dataL = new Uint8Array(bufferLength);
  const dataR = new Uint8Array(bufferLength);
  if (graph.analyserL) graph.analyserL.getByteFrequencyData(dataL);
  if (graph.analyserR) graph.analyserR.getByteFrequencyData(dataR);

  const leftLevel = readAnalyserLevel(graph.analyserL);
  const rightLevel = readAnalyserLevel(graph.analyserR);

  const leftMax = maxBin(dataL);
  const rightMax = maxBin(dataR);
  const hasDataL = leftMax > 0;
  const hasDataR = rightMax > 0;
  const topData = hasDataL || !hasDataR ? dataL : dataR;
  const bottomData = hasDataR || !hasDataL ? dataR : dataL;
  const topLevel = hasDataL || !hasDataR ? leftLevel : rightLevel;
  const bottomLevel = hasDataR || !hasDataL ? rightLevel : leftLevel;
  topMax = maxBin(topData);
  bottomMax = maxBin(bottomData);
  leftRms = topLevel.rms;
  rightRms = bottomLevel.rms;
  leftPeak = topLevel.peak;
  rightPeak = bottomLevel.peak;
  leftMeterWidth = smoothLevel(leftMeterWidth, meterTarget(topLevel));
  rightMeterWidth = smoothLevel(rightMeterWidth, meterTarget(bottomLevel));
  updateMeterElements('playing');
  const sideData = new Uint8Array(bufferLength);
  for (let i = 0; i < bufferLength; i += 1) {
    sideData[i] = Math.max(dataL[i] ?? 0, dataR[i] ?? 0);
  }
  sideMax = maxBin(sideData);

  if (hasDataL || hasDataR) {
    zeroFrameCount = 0;
    rootCause = null;
    eqMode = hasDataL && hasDataR ? 'real-stereo' : 'mono-fallback';
  } else {
    zeroFrameCount += 1;
    resetMeters();
  }

  if (views.topCtx && views.topCanvas) drawBars(views.topCtx, topData, bufferLength, true);
  if (views.bottomCtx && views.bottomCanvas) drawBars(views.bottomCtx, bottomData, bufferLength, false);

  if (views.sideCtx && views.sideCanvas) drawSide(views.sideCtx, sideData);

  if (!hasDataL && !hasDataR && zeroFrameCount > 24) {
    classifyMode();
  }

  views.rafId = requestAnimationFrame(tick);
  updateDebug();
}

function classifyMode(): void {
  if (!graph.audioCtx || !graph.connected) {
    eqMode = 'unavailable';
    rootCause = 'audio graph is not connected';
  } else {
    eqMode = 'cors-blocked';
    rootCause = 'analyser returned only zero data after graph connection';
  }
  logMode(eqMode);
  updateDebug();
}

function ensureGraph(audioEl: HTMLAudioElement): boolean {
  if (graph.connected && graph.source && graph.audioElement === audioEl) return true;
  try {
    const ctx = ensureAudioContext();
    if (!ctx) { eqMode = 'unavailable'; return false; }
    if (graph.source && graph.audioElement !== audioEl) {
      eqMode = 'unavailable';
      rootCause = 'persistent audio element changed after media source creation';
      updateDebug();
      return false;
    }

    if (!graph.source) graph.source = ctx.createMediaElementSource(audioEl);
    if (!graph.gainNode) graph.gainNode = ctx.createGain();
    if (!graph.splitter) graph.splitter = ctx.createChannelSplitter(2);
    if (!graph.analyserL) graph.analyserL = ctx.createAnalyser();
    if (!graph.analyserR) graph.analyserR = ctx.createAnalyser();
    graph.analyserL.fftSize = 128;
    graph.analyserR.fftSize = 128;

    graph.source.connect(graph.gainNode);
    graph.gainNode.connect(ctx.destination);
    graph.gainNode.connect(graph.splitter);
    graph.splitter.connect(graph.analyserL, 0);
    graph.splitter.connect(graph.analyserR, 1);

    graph.connected = true;
    graph.destinationConnected = true;
    graph.audioElement = audioEl;
    bindFinalUnloadTeardown();
    eqMode = 'real-stereo';
    modeLogged = false;
    zeroFrameCount = 0;
    rootCause = null;
    updateDebug();
    logMode(eqMode);
    return true;
  } catch {
    graph.connected = Boolean(graph.source && graph.gainNode && graph.splitter && graph.analyserL && graph.analyserR);
    graph.destinationConnected = graph.connected;
    eqMode = 'cors-blocked';
    rootCause = 'media element source graph could not be created';
    updateDebug();
    logMode(eqMode);
    return false;
  }
}

function destroyGraph(): void {
  stopAnimation();
  eqMode = 'paused';
  updateDebug();
}

function disconnectGraph(): void {
  stopAnimation();
  if (graph.source) { try { graph.source.disconnect(); } catch { /* ignore */ } }
  if (graph.gainNode) { try { graph.gainNode.disconnect(); } catch { /* ignore */ } }
  if (graph.splitter) { try { graph.splitter.disconnect(); } catch { /* ignore */ } }
  if (graph.analyserL) { try { graph.analyserL.disconnect(); } catch { /* ignore */ } }
  if (graph.analyserR) { try { graph.analyserR.disconnect(); } catch { /* ignore */ } }
  if (graph.audioCtx) { void graph.audioCtx.close(); }
}

function bindFinalUnloadTeardown(): void {
  if (graph.unloadBound) return;
  graph.unloadBound = true;
  window.addEventListener('pagehide', disconnectGraph, { once: true });
}

function stopAnimation(): void {
  isActive = false;
  if (views.rafId !== null) { cancelAnimationFrame(views.rafId); views.rafId = null; }
}

export function createSideVisualizer(canvasEl: HTMLCanvasElement): SideVisualizerHandle {
  views.sideCanvas = canvasEl;
  views.sideCtx = getCtx(views.sideCanvas);
  observeCanvases();
  if (views.sideCtx) drawSideStatic(views.sideCtx);
  views.canvasGeneration += 1;
  updateDebug();

  return {
    setAudioElement(el: HTMLAudioElement | null): void {
      if (el && isActive) ensureGraph(el);
    },
    start(): void { /* side uses same tick loop */ },
    stop(): void {
      if (views.sideCtx && views.sideCanvas) drawSideStatic(views.sideCtx);
    },
    destroy(): void {
      views.sideCanvas = null;
      views.sideCtx = null;
      observeCanvases();
      views.canvasGeneration += 1;
      updateDebug();
    },
  };
}

export function createEqualizer(left: HTMLCanvasElement, right: HTMLCanvasElement): EqualizerHandle {
  views.topCanvas = left;
  views.bottomCanvas = right;
  views.topCtx = getCtx(views.topCanvas);
  views.bottomCtx = getCtx(views.bottomCanvas);
  views.canvasGeneration += 1;
  observeCanvases();
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handle: EqualizerHandle = {
    prepare(): void {
      void resumeAudioContext();
    },

    getMode(): EqMode {
      return eqMode;
    },

    start(): void {
      if (isActive && views.rafId !== null) return;
      isActive = true;
      meterDecayPending = false;
      if (reducedMotion) return;
      if (graph.audioElement && !graph.connected) {
        ensureGraph(graph.audioElement);
      }
      if (graph.connected && (eqMode === 'paused' || eqMode === 'unavailable' || eqMode === 'cors-blocked')) {
        eqMode = 'real-stereo';
        rootCause = null;
      } else if (eqMode === 'unavailable') {
        classifyMode();
      }
      if (views.rafId !== null) cancelAnimationFrame(views.rafId);
      views.rafId = requestAnimationFrame(tick);
      updateDebug();
    },

    stop(): void {
      isActive = false;
      eqMode = 'paused';
      drawStatic();
      resetMeters();
      updateDebug();
      meterDecayPending = metersNeedDecay();
      if (views.rafId !== null) cancelAnimationFrame(views.rafId);
      views.rafId = meterDecayPending ? requestAnimationFrame(tick) : null;
    },

    setAudioElement(el: HTMLAudioElement | null): void {
      if (!el) return;
      if (graph.connected && graph.audioElement === el) return;
      graph.audioElement = el;
      ensureGraph(el);
      updateDebug();
    },

    rebindCanvases(
      top: HTMLCanvasElement | null,
      bottom: HTMLCanvasElement | null,
      side?: HTMLCanvasElement | null,
    ): void {
      views.topCanvas = top;
      views.bottomCanvas = bottom;
      views.topCtx = top ? getCtx(top) : null;
      views.bottomCtx = bottom ? getCtx(bottom) : null;
      if (side !== undefined) {
        views.sideCanvas = side;
        views.sideCtx = side ? getCtx(side) : null;
      }
      views.canvasGeneration += 1;
      observeCanvases();
      drawStatic();
      updateDebug();
    },

    rebindSideCanvas(side: HTMLCanvasElement | null): void {
      views.sideCanvas = side;
      views.sideCtx = side ? getCtx(side) : null;
      views.canvasGeneration += 1;
      observeCanvases();
      drawStatic();
      updateDebug();
    },

    rebindMeters(left: HTMLElement | null, right: HTMLElement | null): void {
      views.leftMeter = left;
      views.rightMeter = right;
      updateMeterElements(eqMode === 'paused' ? 'paused' : graph.connected ? 'playing' : 'inactive');
      updateDebug();
    },

    syncWithCurrentPlaybackState(isPlaying: boolean): void {
      if (isPlaying) {
        handle.start();
      } else {
        handle.stop();
      }
    },

    setCurrentStationId(stationId: string | null): void {
      currentStationId = stationId;
      updateDebug();
    },

    resize(): void {
      observeCanvases();
      drawStatic();
      updateDebug();
    },

    destroy(): void {
      destroyGraph();
      views.topCanvas = null;
      views.bottomCanvas = null;
      views.topCtx = null;
      views.bottomCtx = null;
      views.leftMeter = null;
      views.rightMeter = null;
    },
  };

  drawStatic();
  return handle;
}
