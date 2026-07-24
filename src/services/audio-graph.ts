/*
Web Audio API graph manager.
Owns the persistent AudioContext, MediaElementAudioSourceNode, GainNode,
ChannelSplitterNode and two AnalyserNodes (L/R).

The graph is created once and persists across page navigation. Only the
canvas views are replaced on route change. The graph is disconnected and
closed only on pagehide, never during navigation.

MediaElementAudioSourceNode can be created only once per <audio> element;
a second call throws. ensureGraph guards against this by checking whether
the source already exists and whether the audio element has changed.
If the element changes (should not happen with a persistent <audio>),
the function rejects silently rather than rebuild.
*/

/** Persistent state of the Web Audio API graph. */
export interface PersistentVisualizerGraph {
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

export { graph as audioGraph };

/**
 * Get or create the shared AudioContext. Resumes if suspended.
 * @returns The AudioContext, or null if creation failed.
 */
export function ensureAudioContext(): AudioContext | null {
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

/**
 * Resume the shared AudioContext if suspended.
 * Safe to call even when context is null or already running.
 */
export function resumeAudioContext(): Promise<void> {
  const ctx = graph.audioCtx;
  if (ctx && ctx.state === 'suspended') {
    return ctx.resume().then(() => undefined).catch(() => undefined);
  }
  return Promise.resolve();
}

/**
 * Build the full audio graph (source -> gain -> destination + splitter -> analysers).
 * Must be called once per media element lifetime.
 * @returns true when the graph is fully connected.
 */
export function ensureGraph(audioEl: HTMLAudioElement): boolean {
  if (graph.connected && graph.source && graph.audioElement === audioEl) return true;
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return false;
    // createMediaElementSource throws if called twice on the same <audio>.
    // Reject silently when the element changes rather than orphan the source.
    if (graph.source && graph.audioElement !== audioEl) return false;

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
    return true;
  } catch {
    graph.connected = Boolean(graph.source && graph.gainNode && graph.splitter && graph.analyserL && graph.analyserR);
    graph.destinationConnected = graph.connected;
    return false;
  }
}

/** Disconnect and close the entire audio graph. Called on pagehide. */
export function graphDisconnect(): void {
  if (graph.source) { try { graph.source.disconnect(); } catch { /* ignore */ } }
  if (graph.gainNode) { try { graph.gainNode.disconnect(); } catch { /* ignore */ } }
  if (graph.splitter) { try { graph.splitter.disconnect(); } catch { /* ignore */ } }
  if (graph.analyserL) { try { graph.analyserL.disconnect(); } catch { /* ignore */ } }
  if (graph.analyserR) { try { graph.analyserR.disconnect(); } catch { /* ignore */ } }
  if (graph.audioCtx) { void graph.audioCtx.close(); }
}
