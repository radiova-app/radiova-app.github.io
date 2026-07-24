/** PWA installation state machine values. */
export type PWAState = 'unsupported' | 'installed' | 'installable' | 'installing';

let deferredPrompt: Event | null = null;
let currentState: PWAState = 'unsupported';
let stateListeners: Array<(state: PWAState) => void> = [];

/**
 * Return the current PWA install state.
 * @returns The current PWAState.
 */
export function getPWAState(): PWAState {
  return currentState;
}

/**
 * Subscribe to PWA state changes.
 * @param fn - Callback receiving the new PWAState.
 * @returns Unsubscribe function.
 */
export function onPWAStateChange(fn: (state: PWAState) => void): () => void {
  stateListeners.push(fn);
  return () => {
    stateListeners = stateListeners.filter((f) => f !== fn);
  };
}

function notifyState(): void {
  for (const fn of stateListeners) fn(currentState);
}

/**
 * Check whether the PWA is currently installed and running standalone.
 * @returns true if in standalone display mode.
 */
export function isInstalled(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

/**
 * Check whether the PWA runs in standalone mode (alias for isInstalled).
 * @returns true if standalone.
 */
export function isStandalone(): boolean {
  return isInstalled();
}

/** Initialise PWA install detection and event listeners. */
export function initPWA(): void {
  if (isInstalled()) {
    currentState = 'installed';
    notifyState();
    return;
  }

  if ('onbeforeinstallprompt' in window || 'BeforeInstallPromptEvent' in window) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      currentState = 'installable';
      notifyState();
    });
  }

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    currentState = 'installed';
    notifyState();
  });
}

/**
 * Show the browser install prompt.
 * @returns true if the prompt was shown successfully.
 */
export async function promptInstall(): Promise<boolean> {
  const prompt = deferredPrompt as { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> } | null;
  if (!prompt || typeof prompt.prompt !== 'function') return false;

  try {
    currentState = 'installing';
    notifyState();
    await prompt.prompt();
    currentState = 'installable';
    deferredPrompt = null;
    return true;
  } catch {
    currentState = 'installable';
    return false;
  }
}
