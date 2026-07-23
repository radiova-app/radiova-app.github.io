export type PlayerState = 'idle' | 'playing' | 'paused' | 'error' | 'loading';

export interface PlayerStationInfo {
  stationId: string | null;
  stationName: string;
  artworkUrl: string | null;
  endpointId: string | null;
  endpointUrl: string | null;
  endpointLabel: string | null;
}

export interface SharedPlayerState {
  station: PlayerStationInfo;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  status: PlayerState;
  errorMessage: string | null;
  updatedAt: number;
}

const STORAGE_KEY_VOLUME = 'radiova-vol';
const STORAGE_KEY_MUTED = 'radiova-muted';

let audio: HTMLAudioElement | null = null;
let currentState: PlayerState = 'idle';
let stateListeners: Array<(state: PlayerState) => void> = [];
let errorListeners: Array<(msg: string) => void> = [];
let changeListeners: Array<(state: SharedPlayerState) => void> = [];
let currentUrl: string = '';
let currentStationInfo: PlayerStationInfo = {
  stationId: null,
  stationName: 'No station selected',
  artworkUrl: null,
  endpointId: null,
  endpointUrl: null,
  endpointLabel: null,
};

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = document.getElementById('persistent-audio') as HTMLAudioElement | null;
    if (!audio) {
      audio = new Audio();
    }
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';

    audio.onplay = () => {
      currentState = 'playing';
      notifyState();
      notifyChange();
    };
    audio.onpause = () => {
      currentState = 'paused';
      notifyState();
      notifyChange();
    };
    audio.onwaiting = () => {
      currentState = 'loading';
      notifyState();
      notifyChange();
    };
    audio.onerror = () => {
      currentState = 'error';
      notifyState();
      notifyChange();
      const errCode = audio?.error?.code ?? 0;
      const errMsg = audio?.error?.message || 'Unable to play this stream';
      for (const fn of errorListeners) fn(errMsg + ' (code=' + String(errCode) + ')');
    };
    audio.onended = () => {
      currentState = 'idle';
      notifyState();
      notifyChange();
    };

    const vol = loadVolume();
    audio.volume = vol;
    audio.muted = loadMuted();
  }
  return audio;
}

function notifyState(): void {
  for (const fn of stateListeners) fn(currentState);
}

function notifyChange(): void {
  const state: SharedPlayerState = {
    station: { ...currentStationInfo },
    isPlaying: currentState === 'playing',
    isMuted: audio ? audio.muted : loadMuted(),
    volume: audio ? audio.volume : loadVolume(),
    status: currentState,
    errorMessage: null,
    updatedAt: Date.now(),
  };
  for (const fn of changeListeners) fn(state);
}

function loadVolume(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY_VOLUME);
    if (v !== null) {
      const n = parseFloat(v);
      if (n >= 0 && n <= 1) return n;
    }
  } catch {
    // ignore
  }
  return 0.75;
}

function saveVolume(v: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
  } catch {
    // ignore
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
  } catch {
    return false;
  }
}

function saveMuted(m: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_MUTED, String(m));
  } catch {
    // ignore
  }
}

export function getState(): PlayerState {
  return currentState;
}

export function getCurrentUrl(): string {
  return currentUrl;
}

export function onStateChange(fn: (state: PlayerState) => void): () => void {
  stateListeners.push(fn);
  return () => {
    stateListeners = stateListeners.filter((f) => f !== fn);
  };
}

export function onError(fn: (msg: string) => void): () => void {
  errorListeners.push(fn);
  return () => {
    errorListeners = errorListeners.filter((f) => f !== fn);
  };
}

export function onChange(fn: (state: SharedPlayerState) => void): () => void {
  changeListeners.push(fn);
  return () => {
    changeListeners = changeListeners.filter((f) => f !== fn);
  };
}

export function getAudioElement(): HTMLAudioElement | null {
  return audio;
}

export function play(url: string): void {
  const el = getAudio();

  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  if (isSecure && url.startsWith('http://')) {
    const upgraded = 'https://' + url.slice(7);
    url = upgraded;
  }

  if (currentUrl !== url) {
    el.src = url;
    currentUrl = url;
  }
  currentState = 'loading';
  notifyState();
  notifyChange();
  el.play().then(() => {
    // playback started successfully
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('user gesture') || message.includes('not allowed') || message.includes('autoplay')) {
      currentState = 'paused';
      notifyState();
      notifyChange();
    } else {
      currentState = 'error';
      notifyState();
      notifyChange();
      for (const fn of errorListeners) fn(message);
    }
  });
}

export function pause(): void {
  if (audio) {
    audio.pause();
  }
}

export function stop(): void {
  if (audio) {
    audio.pause();
    audio.src = '';
    currentUrl = '';
  }
  currentState = 'idle';
  notifyState();
  notifyChange();
}

export function getVolume(): number {
  if (!audio) return loadVolume();
  return audio.volume;
}

export function setVolume(v: number): void {
  const el = getAudio();
  const clamped = Math.max(0, Math.min(1, v));
  el.volume = clamped;
  saveVolume(clamped);
  notifyChange();
  document.dispatchEvent(new CustomEvent('radiova:volume-changed', { detail: clamped }));
}

export function isMuted(): boolean {
  if (!audio) return loadMuted();
  return audio.muted;
}

export function setMuted(m: boolean): void {
  const el = getAudio();
  el.muted = m;
  saveMuted(m);
  notifyChange();
  document.dispatchEvent(new CustomEvent('radiova:mute-changed', { detail: m }));
}

export function toggleMute(): void {
  setMuted(!isMuted());
}

export function getStationInfo(): PlayerStationInfo {
  return { ...currentStationInfo };
}

export function setStationInfo(info: PlayerStationInfo): void {
  currentStationInfo = { ...info };
  notifyChange();
}
