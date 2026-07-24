import {
  PLAY_ICON_FULL,
  PAUSE_ICON_FULL,
  SPINNER_ICON_FULL,
  WARNING_ICON_FULL,
} from "./icons";

export type PlayerStatus =
  | "idle"
  | "loading"
  | "waiting"
  | "retrying"
  | "playing"
  | "paused"
  | "error";

export function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function isLoadingStatus(status: PlayerStatus): boolean {
  return status === "loading" || status === "waiting" || status === "retrying";
}

export function iconForStatus(status: PlayerStatus): string {
  if (status === "playing") return PAUSE_ICON_FULL;
  if (isLoadingStatus(status)) return SPINNER_ICON_FULL;
  if (status === "error") return WARNING_ICON_FULL;
  return PLAY_ICON_FULL;
}

export function ariaLabelForStatus(status: PlayerStatus): string {
  if (status === "playing") return "Pause";
  if (isLoadingStatus(status)) return "Loading stream";
  if (status === "error") return "Stream error. Retry";
  return "Play";
}

export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function isSecureContext(): boolean {
  return window.location.protocol === "https:";
}

export function safeArtworkUrl(
  url: string | undefined,
  log?: (msg: string) => void,
): string {
  if (!url) return "";
  if (url.startsWith("https://")) return url;
  if (url.startsWith("http://")) {
    if (isSecureContext()) {
      log?.("artwork: mixed-content blocked " + url.slice(0, 60));
      return "";
    }
    return url;
  }
  log?.("artwork: invalid scheme " + url.slice(0, 60));
  return "";
}

export function dispatch(
  name: string,
  detail?: unknown,
  target: Document | Window = document,
): void {
  target.dispatchEvent(
    new CustomEvent(name, detail !== undefined ? { detail } : undefined),
  );
}

export function listen(
  name: string,
  handler: EventListenerOrEventListenerObject,
  target: Document | Window = document,
): () => void {
  target.addEventListener(name, handler);
  return () => { target.removeEventListener(name, handler); };
}
