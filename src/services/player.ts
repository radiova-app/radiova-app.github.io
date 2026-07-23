import { hasConsent } from "./consent";

export type PlayerState =
  "idle" | "loading" | "waiting" | "retrying" | "playing" | "paused" | "error";

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
  statusLabel: string;
  errorMessage: string | null;
  updatedAt: number;
}

const STORAGE_KEY_VOLUME = "radiova-vol";
const STORAGE_KEY_MUTED = "radiova-muted";

let audio: HTMLAudioElement | null = null;
let currentState: PlayerState = "idle";
let stateListeners: Array<(state: PlayerState) => void> = [];
let errorListeners: Array<(msg: string) => void> = [];
let changeListeners: Array<(state: SharedPlayerState) => void> = [];
let currentUrl: string = "";
let currentErrorMessage: string | null = null;
let currentStationInfo: PlayerStationInfo = {
  stationId: null,
  stationName: "No station selected",
  artworkUrl: null,
  endpointId: null,
  endpointUrl: null,
  endpointLabel: null,
};

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = document.getElementById("persistent-audio") as HTMLAudioElement | null;
    if (!audio) {
      audio = new Audio();
    }
    audio.preload = "none";
    audio.crossOrigin = "anonymous";

    bindMediaEvents(audio);

    const vol = loadVolume();
    audio.volume = vol;
    audio.muted = loadMuted();
  }
  return audio;
}

function bindMediaEvents(el: HTMLAudioElement): void {
  el.addEventListener("loadstart", () => {
    if (currentState === "error") return;
    setState("loading");
  });
  el.addEventListener("waiting", () => {
    if (currentState === "error") return;
    setState("waiting");
  });
  el.addEventListener("stalled", () => {
    if (currentState === "error") return;
    setState("waiting");
  });
  el.addEventListener("canplay", () => {
    /* canplay is not playback. */
  });
  el.addEventListener("playing", () => {
    setState("playing");
  });
  el.addEventListener("pause", () => {
    if (currentState === "error") return;
    setState("paused");
  });
  el.addEventListener("ended", () => {
    if (currentState === "error") return;
    setState("paused");
  });
  el.addEventListener("abort", () => {
    /* Abort can be emitted while switching fallback streams; it is not a pause signal. */
  });
  el.addEventListener("emptied", () => {
    if (!currentUrl) setState("idle");
  });
  el.addEventListener("error", () => {
    const errCode = audio?.error?.code ?? 0;
    const errMsg = audio?.error?.message || "Unable to play this stream";
    for (const fn of errorListeners) fn(errMsg + " (code=" + String(errCode) + ")");
  });
}

function setState(nextState: PlayerState, errorMessage: string | null = null): void {
  if (currentState === nextState && currentErrorMessage === errorMessage) return;
  currentState = nextState;
  currentErrorMessage = errorMessage;
  notifyState();
  notifyChange();
}

function notifyState(): void {
  for (const fn of stateListeners) fn(currentState);
}

function notifyChange(): void {
  const state: SharedPlayerState = {
    station: { ...currentStationInfo },
    isPlaying: currentState === "playing",
    isMuted: audio ? audio.muted : loadMuted(),
    volume: audio ? audio.volume : loadVolume(),
    status: currentState,
    statusLabel: getPlaybackStatusLabel(currentState),
    errorMessage: currentErrorMessage,
    updatedAt: Date.now(),
  };
  for (const fn of changeListeners) fn(state);
}

function loadVolume(): number {
  if (!hasConsent("preferences")) return 0.75;
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
  if (!hasConsent("preferences")) return;
  try {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
  } catch {
    // ignore
  }
}

function loadMuted(): boolean {
  if (!hasConsent("preferences")) return false;
  try {
    return localStorage.getItem(STORAGE_KEY_MUTED) === "true";
  } catch {
    return false;
  }
}

function saveMuted(m: boolean): void {
  if (!hasConsent("preferences")) return;
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

export function getSharedPlayerState(): SharedPlayerState {
  return {
    station: { ...currentStationInfo },
    isPlaying: currentState === "playing",
    isMuted: audio ? audio.muted : loadMuted(),
    volume: audio ? audio.volume : loadVolume(),
    status: currentState,
    statusLabel: getPlaybackStatusLabel(currentState),
    errorMessage: currentErrorMessage,
    updatedAt: Date.now(),
  };
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

  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  if (isSecure && url.startsWith("http://")) {
    const upgraded = "https://" + url.slice(7);
    url = upgraded;
  }

  const requestedUrl = url;

  if (currentUrl !== requestedUrl) {
    el.src = url;
    currentUrl = requestedUrl;
  }
  setState("loading");
  el.play()
    .then(() => {
      // The playing event is the only source of the public playing state.
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const name =
        typeof DOMException !== "undefined" && err instanceof DOMException ? err.name : "";
      if (name === "AbortError" || message.includes("interrupted") || message.includes("aborted")) {
        if (currentUrl !== requestedUrl) return;
        setState("paused");
      } else if (
        message.includes("user gesture") ||
        message.includes("not allowed") ||
        message.includes("autoplay")
      ) {
        setState("paused");
      } else {
        for (const fn of errorListeners) fn(message);
      }
    });
}

export function togglePlayback(): void {
  if (currentState === "playing" || currentState === "loading") {
    pause();
  } else if (currentUrl) {
    play(currentUrl);
  }
}

export function pause(): void {
  if (audio) {
    audio.pause();
  }
}

export function stop(): void {
  if (audio) {
    audio.pause();
    audio.src = "";
    currentUrl = "";
  }
  setState("idle");
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
  document.dispatchEvent(new CustomEvent("radiova:volume-changed", { detail: clamped }));
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
  document.dispatchEvent(new CustomEvent("radiova:mute-changed", { detail: m }));
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

export function setPlaybackStatus(status: PlayerState, errorMessage: string | null = null): void {
  setState(status, errorMessage);
}

export function getPlaybackStatusLabel(status: PlayerState): string {
  const docLang = typeof document === "undefined" ? "en" : document.documentElement.lang;
  const lang = docLang === "uk" || docLang === "de" ? docLang : "en";
  const labels: Record<"en" | "uk" | "de", Record<PlayerState, string>> = {
    en: {
      idle: "Choose a station from the list",
      loading: "Loading...",
      playing: "Playing",
      paused: "Paused",
      waiting: "Waiting for stream...",
      retrying: "Trying another stream...",
      error: "Stream error",
    },
    uk: {
      idle: "Виберіть станцію зі списку",
      loading: "Завантаження...",
      playing: "Грає",
      paused: "Призупинено",
      waiting: "Очікування потоку...",
      retrying: "Спроба іншого потоку...",
      error: "Помилка потоку",
    },
    de: {
      idle: "Wählen Sie einen Sender aus der Liste",
      loading: "Wird geladen...",
      playing: "Wiedergabe",
      paused: "Pausiert",
      waiting: "Stream wird erwartet...",
      retrying: "Anderer Stream wird versucht...",
      error: "Streamfehler",
    },
  };
  return labels[lang][status];
}
