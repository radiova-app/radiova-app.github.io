export type PWAState = 'unsupported' | 'installed' | 'installable' | 'installing';

let deferredPrompt: Event | null = null;
let currentState: PWAState = 'unsupported';
let stateListeners: Array<(state: PWAState) => void> = [];

export function getPWAState(): PWAState {
  return currentState;
}

export function onPWAStateChange(fn: (state: PWAState) => void): () => void {
  stateListeners.push(fn);
  return () => {
    stateListeners = stateListeners.filter((f) => f !== fn);
  };
}

function notifyState(): void {
  for (const fn of stateListeners) fn(currentState);
}

export function isInstalled(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

export function isStandalone(): boolean {
  return isInstalled();
}

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
