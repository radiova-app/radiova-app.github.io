export const PLAY_PATH =
  '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>';
export const PAUSE_PATH =
  '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>';
export const SPINNER_PATH =
  '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" opacity="0.25"/><path d="M20 12a8 8 0 00-8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
export const WARNING_PATH =
  '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

export function iconFull(path: string): string {
  return `<svg viewBox="0 0 24 24" class="menu-icon" aria-hidden="true">${path}</svg>`;
}

export function iconSpinner(path: string): string {
  return `<svg viewBox="0 0 24 24" class="menu-icon loading-spinner" aria-hidden="true">${path}</svg>`;
}

export function iconWarning(path: string): string {
  return `<svg viewBox="0 0 24 24" class="menu-icon warning-icon" aria-hidden="true">${path}</svg>`;
}

export const PLAY_ICON_FULL = iconFull(PLAY_PATH);
export const PAUSE_ICON_FULL = iconFull(PAUSE_PATH);
export const SPINNER_ICON_FULL = iconSpinner(SPINNER_PATH);
export const WARNING_ICON_FULL = iconWarning(WARNING_PATH);

export const STAR_FILL = "\u2605";
export const STAR_EMPTY = "\u2606";
