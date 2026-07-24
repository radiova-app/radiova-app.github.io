import {
  PLAY_ICON_FULL,
  PAUSE_ICON_FULL,
  SPINNER_ICON_FULL,
  WARNING_ICON_FULL,
} from "./icons";

/** Player status values used for UI state rendering. */
export type PlayerStatus =
  | "idle"
  | "loading"
  | "waiting"
  | "retrying"
  | "playing"
  | "paused"
  | "error";

/**
 * Shorthand for document.getElementById.
 * @param id - The element ID.
 * @returns The element, or null.
 */
export function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

/**
 * Check whether a PlayerStatus represents a loading state.
 * @param status - The player status.
 * @returns true if loading, waiting, or retrying.
 */
export function isLoadingStatus(status: PlayerStatus): boolean {
  return status === "loading" || status === "waiting" || status === "retrying";
}

/**
 * Return the appropriate SVG icon HTML for a player status.
 * @param status - The player status.
 * @returns The icon HTML string.
 */
export function iconForStatus(status: PlayerStatus): string {
  if (status === "playing") return PAUSE_ICON_FULL;
  if (isLoadingStatus(status)) return SPINNER_ICON_FULL;
  if (status === "error") return WARNING_ICON_FULL;
  return PLAY_ICON_FULL;
}

/**
 * Return the aria-label text for a player status button.
 * @param status - The player status.
 * @returns The aria-label string.
 */
export function ariaLabelForStatus(status: PlayerStatus): string {
  if (status === "playing") return "Pause";
  if (isLoadingStatus(status)) return "Loading stream";
  if (status === "error") return "Stream error. Retry";
  return "Play";
}

/**
 * Escape HTML entities in a string.
 * @param str - The raw string.
 * @returns The escaped HTML string.
 */
export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Check whether the page is served over HTTPS.
 * @returns true if the protocol is https:.
 */
export function isSecureContext(): boolean {
  return window.location.protocol === "https:";
}

/**
 * Validate and sanitise an artwork URL.
 * Blocks mixed-content HTTP URLs in HTTPS contexts.
 * @param url - The raw artwork URL.
 * @param log - Optional diagnostic logger.
 * @returns The safe URL string, or empty string.
 */
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

/**
 * Dispatch a CustomEvent on a target.
 * @param name - The event name.
 * @param detail - Optional event detail.
 * @param target - The target to dispatch on (default: document).
 */
export function dispatch(
  name: string,
  detail?: unknown,
  target: Document | Window = document,
): void {
  target.dispatchEvent(
    new CustomEvent(name, detail !== undefined ? { detail } : undefined),
  );
}

/**
 * Add an event listener and return an unsubscribe function.
 * @param name - The event name.
 * @param handler - The event handler.
 * @param target - The target to listen on (default: document).
 * @returns An unsubscribe function.
 */
export function listen(
  name: string,
  handler: EventListenerOrEventListenerObject,
  target: Document | Window = document,
): () => void {
  target.addEventListener(name, handler);
  return () => { target.removeEventListener(name, handler); };
}
