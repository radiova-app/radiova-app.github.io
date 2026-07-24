/*
Equalizer integration layer.
Weaves together three concerns:
  1. Audio graph (audio-graph.ts)     — persistent Web Audio nodes
  2. Level maths (level-meter.ts)      — pure RMS/peak/smooth functions
  3. Canvas drawing (canvas-renderer.ts) — stateless bar rendering

Architectural rules:
  - Graph outlives views. The audio graph is created once and persists
    across page navigation. Only canvas references (topCtx, bottomCtx, ...)
    are rebound on route change. The graph is never rebuilt during
    navigation.
  - One RAF loop. A single requestAnimationFrame (tick) handles frequency
    data collection, level calculation, meter DOM updates, and canvas
    drawing. Decay animation may extend the loop briefly after pause,
    but never spawns a second concurrent loop.
  - Visualizer failure never interrupts playback. Missing canvases,
    null contexts, silent AnalyserNodes, or exceptions in drawing code
    degrade the visual output silently. Audio continues uninterrupted.
  - Meter state (leftRms, rightRms, leftMeterWidth, ...) lives here,
    computed in tick() and pushed to DOM level-fill elements.
*/

import {
  audioGraph,
  resumeAudioContext,
  ensureGraph,
  graphDisconnect,
} from "../services/audio-graph";
import {
  smoothLevel,
  maxBin,
  meterTarget,
  readAnalyserLevel,
} from "../services/level-meter";
import {
  resizeCanvasToDisplaySize,
  getCtx,
  drawBars,
  drawSide,
  drawSideStatic,
  drawStaticCanvas,
} from "../visualizer/canvas-renderer";

/**
 * Current visualiser operational mode.
 * - real-stereo: L/R analysers return data.
 * - mono-fallback: only one channel has data.
 * - cors-blocked: graph connected but analysers return zero.
 * - unavailable: audio graph not connected.
 * - paused: user paused playback.
 */
export type EqMode = "real-stereo" | "mono-fallback" | "cors-blocked" | "unavailable" | "paused";

/** Public API returned by createEqualizer. */
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

/** Public API returned by createSideVisualizer. */
export interface SideVisualizerHandle {
  setAudioElement: (el: HTMLAudioElement | null) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

/** Debug snapshot exposed as window.__radiovaVisualizerDebug. */
export interface VisualizerDebugState {
  mode: EqMode;
  audioElement: boolean;
  audioContextState: AudioContextState | "missing";
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
let eqMode: EqMode = "unavailable";
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
let teardownBound = false;

function logMode(mode: EqMode): void {
  if (modeLogged) return;
  modeLogged = true;
  const isDev =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isDev) console.log("equalizer mode: " + mode);
}

function resetMeters(state: "inactive" | "loading" | "playing" | "paused" | "error" = "paused"): void {
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

function updateMeterElements(
  state: "inactive" | "loading" | "playing" | "paused" | "error",
): void {
  if (views.leftMeter) {
    views.leftMeter.style.width = String(leftMeterWidth * 100) + "%";
    views.leftMeter.dataset["meterState"] = state;
  }
  if (views.rightMeter) {
    views.rightMeter.style.width = String(rightMeterWidth * 100) + "%";
    views.rightMeter.dataset["meterState"] = state;
  }
}

function updateDebug(): void {
  const g = audioGraph;
  window.__radiovaVisualizerDebug = {
    mode: eqMode,
    audioElement: Boolean(g.audioElement),
    audioContextState: g.audioCtx?.state ?? "missing",
    sourceCreated: Boolean(g.source),
    splitterCreated: Boolean(g.splitter),
    mediaElementSourceCount: g.source ? 1 : 0,
    gainNodePresent: Boolean(g.gainNode),
    channelSplitterPresent: Boolean(g.splitter),
    leftAnalyserPresent: Boolean(g.analyserL),
    rightAnalyserPresent: Boolean(g.analyserR),
    destinationConnected: g.destinationConnected,
    topCanvasBound: Boolean(views.topCanvas),
    bottomCanvasBound: Boolean(views.bottomCanvas),
    sideCanvasBound: Boolean(views.sideCanvas),
    leftCanvas: Boolean(views.topCanvas),
    rightCanvas: Boolean(views.bottomCanvas),
    canvasSizes: {
      top: views.topCanvas
        ? String(views.topCanvas.width) + "x" + String(views.topCanvas.height)
        : null,
      bottom: views.bottomCanvas
        ? String(views.bottomCanvas.width) + "x" + String(views.bottomCanvas.height)
        : null,
      side: views.sideCanvas
        ? String(views.sideCanvas.width) + "x" + String(views.sideCanvas.height)
        : null,
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
    audioPaused: g.audioElement ? g.audioElement.paused : null,
    canvasGeneration: views.canvasGeneration,
    corsMode: g.audioElement?.crossOrigin || null,
    rootCause,
  };
}

function drawStatic(): void {
  if (views.topCtx && views.topCanvas) drawStaticCanvas(views.topCtx, true);
  if (views.bottomCtx && views.bottomCanvas) drawStaticCanvas(views.bottomCtx, false);
  if (views.sideCtx && views.sideCanvas) drawSideStatic(views.sideCtx);
}

function observeCanvases(): void {
  views.resizeObserver?.disconnect();
  views.resizeObserver = null;
  const targets = [views.topCanvas, views.bottomCanvas, views.sideCanvas].filter(
    (canvas): canvas is HTMLCanvasElement => Boolean(canvas),
  );
  for (const canvas of targets) resizeCanvasToDisplaySize(canvas);
  if (!("ResizeObserver" in window) || targets.length === 0) return;
  views.resizeObserver = new ResizeObserver(() => {
    for (const canvas of targets) resizeCanvasToDisplaySize(canvas);
    drawStatic();
    updateDebug();
  });
  for (const canvas of targets) views.resizeObserver.observe(canvas);
}

// Single RAF loop. Handles frequency data collection, level
// calculation, meter DOM updates, and canvas drawing. No second
// concurrent loop is ever started — decay after pause reuses tick.
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

  if (eqMode === "paused" || eqMode === "cors-blocked" || eqMode === "unavailable") {
    drawStatic();
    resetMeters(eqMode === "paused" ? "paused" : "inactive");
    updateDebug();
    views.rafId = requestAnimationFrame(tick);
    return;
  }

  const bufferLength = audioGraph.analyserL?.frequencyBinCount ?? 0;
  if (!bufferLength) {
    drawStatic();
    resetMeters();
    updateDebug();
    views.rafId = requestAnimationFrame(tick);
    return;
  }

  const dataL = new Uint8Array(bufferLength);
  const dataR = new Uint8Array(bufferLength);
  if (audioGraph.analyserL) audioGraph.analyserL.getByteFrequencyData(dataL);
  if (audioGraph.analyserR) audioGraph.analyserR.getByteFrequencyData(dataR);

  const leftLevel = readAnalyserLevel(audioGraph.analyserL);
  const rightLevel = readAnalyserLevel(audioGraph.analyserR);

  const leftMaxVal = maxBin(dataL);
  const rightMaxVal = maxBin(dataR);
  const hasDataL = leftMaxVal > 0;
  const hasDataR = rightMaxVal > 0;
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
  updateMeterElements("playing");
  const sideData = new Uint8Array(bufferLength);
  for (let i = 0; i < bufferLength; i += 1) {
    sideData[i] = Math.max(dataL[i] ?? 0, dataR[i] ?? 0);
  }
  sideMax = maxBin(sideData);

  if (hasDataL || hasDataR) {
    zeroFrameCount = 0;
    rootCause = null;
    eqMode = hasDataL && hasDataR ? "real-stereo" : "mono-fallback";
  } else {
    zeroFrameCount += 1;
    resetMeters();
  }

  if (views.topCtx && views.topCanvas)
    drawBars(views.topCtx, topData, bufferLength, true);
  if (views.bottomCtx && views.bottomCanvas)
    drawBars(views.bottomCtx, bottomData, bufferLength, false);

  if (views.sideCtx && views.sideCanvas) drawSide(views.sideCtx, sideData);

  if (!hasDataL && !hasDataR && zeroFrameCount > 24) {
    classifyMode();
  }

  views.rafId = requestAnimationFrame(tick);
  updateDebug();
}

function classifyMode(): void {
  if (!audioGraph.audioCtx || !audioGraph.connected) {
    eqMode = "unavailable";
    rootCause = "audio graph is not connected";
  } else {
    eqMode = "cors-blocked";
    rootCause = "analyser returned only zero data after graph connection";
  }
  logMode(eqMode);
  updateDebug();
}

function stopAnimation(): void {
  isActive = false;
  if (views.rafId !== null) {
    cancelAnimationFrame(views.rafId);
    views.rafId = null;
  }
}

function bindTeardown(): void {
  if (teardownBound) return;
  teardownBound = true;
  window.addEventListener(
    "pagehide",
    () => {
      stopAnimation();
      graphDisconnect();
    },
    { once: true },
  );
}

/**
 * Create a standalone side (radial) visualiser handle.
 * The side visualiser mirrors analyser state without starting an extra RAF loop.
 * @param canvasEl - The canvas element for radial rendering.
 * @returns A SideVisualizerHandle for lifecycle control.
 */
export function createSideVisualizer(canvasEl: HTMLCanvasElement): SideVisualizerHandle {
  views.sideCanvas = canvasEl;
  views.sideCtx = getCtx(views.sideCanvas);
  observeCanvases();
  if (views.sideCtx) drawSideStatic(views.sideCtx);
  views.canvasGeneration += 1;
  updateDebug();
  bindTeardown();

  return {
    setAudioElement(el: HTMLAudioElement | null): void {
      if (el && isActive) ensureGraph(el);
    },
    start(): void {},
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

/**
 * Create the main equalizer visualiser.
 * Binds two canvas elements for L/R bars, starts the RAF loop,
 * and returns a handle for lifecycle management.
 * @param left - The left (top) frequency bar canvas.
 * @param right - The right (bottom) frequency bar canvas.
 * @returns An EqualizerHandle for lifecycle control.
 */
export function createEqualizer(
  left: HTMLCanvasElement,
  right: HTMLCanvasElement,
): EqualizerHandle {
  views.topCanvas = left;
  views.bottomCanvas = right;
  views.topCtx = getCtx(views.topCanvas);
  views.bottomCtx = getCtx(views.bottomCanvas);
  views.canvasGeneration += 1;
  observeCanvases();
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  bindTeardown();

  const handle: EqualizerHandle = {
    prepare(): void {
      void resumeAudioContext();
    },

    getMode(): EqMode {
      return eqMode;
    },

    // Visualizer failure (missing canvases, null contexts, silent
    // analysers) never interrupts audio. The RAF loop continues but
    // draws static placeholder bars when no data is available.
    start(): void {
      if (isActive && views.rafId !== null) return;
      isActive = true;
      meterDecayPending = false;
      if (reducedMotion) return;
      if (audioGraph.audioElement && !audioGraph.connected) {
        ensureGraph(audioGraph.audioElement);
      }
      if (
        audioGraph.connected &&
        (eqMode === "paused" || eqMode === "unavailable" || eqMode === "cors-blocked")
      ) {
        eqMode = "real-stereo";
        rootCause = null;
      } else if (eqMode === "unavailable") {
        classifyMode();
      }
      if (views.rafId !== null) cancelAnimationFrame(views.rafId);
      views.rafId = requestAnimationFrame(tick);
      updateDebug();
    },

    stop(): void {
      isActive = false;
      eqMode = "paused";
      drawStatic();
      resetMeters();
      updateDebug();
      meterDecayPending = metersNeedDecay();
      if (views.rafId !== null) cancelAnimationFrame(views.rafId);
      views.rafId = meterDecayPending ? requestAnimationFrame(tick) : null;
    },

    setAudioElement(el: HTMLAudioElement | null): void {
      if (!el) return;
      if (audioGraph.connected && audioGraph.audioElement === el) return;
      audioGraph.audioElement = el;
      ensureGraph(el);
      updateDebug();
    },

    // Route navigation replaces DOM canvas elements. Only the view
    // references are rebound — the audio graph stays untouched.
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
      updateMeterElements(
        eqMode === "paused" ? "paused" : audioGraph.connected ? "playing" : "inactive",
      );
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
      stopAnimation();
      eqMode = "paused";
      updateDebug();
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
