export type ConsentCategory = "necessary" | "preferences" | "offline" | "diagnostics";

export interface ConsentState {
  version: number;
  status: "unknown" | "accepted" | "declined";
  necessary: true;
  preferences: boolean;
  offline: boolean;
  diagnostics: boolean;
  decidedAt: string | null;
}

export type ConsentMode = "accepted" | "private";

export interface ConsentResolvedDetail {
  mode: ConsentMode;
}

declare global {
  interface Window {
    __radiovaConsentResolved?: ConsentResolvedDetail;
  }
}

export const CONSENT_VERSION = 1;

const STORAGE_KEY = "radiova-consent";
const CACHE_PREFIX = "radiova-";

let currentState: ConsentState = readConsentState();
let resolveConsent: ((state: ConsentState) => void) | null = null;
let consentPromise: Promise<ConsentState> | null = null;

const COPY = {
  en: {
    language: "Consent dialog language",
    title: "Browser storage consent",
    description:
      "Radiova uses local browser storage to save settings, favorite stations, playlists, diagnostics, and offline data. No cookies, advertising cookies, or third-party analytics were found in this site.",
    limited:
      "Without consent, Radiova can run in privacy mode. Radio playback works, but preferences, favorites, custom playlists, diagnostics, and offline data are not saved after closing the tab.",
    accept: "Accept and continue",
    continuePrivate: "Continue in privacy mode",
    privacy: "Privacy policy",
    settings: "Privacy settings",
    review: "Review privacy choices",
    withdraw: "Withdraw consent and clear data",
    close: "Close",
    confirmClear: "Withdraw consent and delete Radiova data from this browser?",
    cleared: "Consent withdrawn. Local Radiova data was cleared.",
  },
  uk: {
    language: "Мова вікна згоди",
    title: "Згода на використання сховища браузера",
    description:
      "Radiova використовує локальне сховище браузера для збереження налаштувань, улюблених станцій, плейлистів, діагностики та офлайн-даних. На цьому сайті не знайдено cookie, рекламних cookie або сторонньої аналітики.",
    limited:
      "Без згоди Radiova може працювати в приватному режимі. Радіо відтворюється, але налаштування, улюблені станції, власні плейлисти, діагностика та офлайн-дані не зберігаються після закриття вкладки.",
    accept: "Прийняти й продовжити",
    continuePrivate: "Продовжити в приватному режимі",
    privacy: "Політика конфіденційності",
    settings: "Налаштування конфіденційності",
    review: "Переглянути вибір конфіденційності",
    withdraw: "Відкликати згоду й очистити дані",
    close: "Закрити",
    confirmClear: "Відкликати згоду й видалити дані Radiova з цього браузера?",
    cleared: "Згоду відкликано. Локальні дані Radiova очищено.",
  },
  de: {
    language: "Sprache des Einwilligungsdialogs",
    title: "Einwilligung zur Browserspeicherung",
    description:
      "Radiova verwendet lokalen Browserspeicher, um Einstellungen, Favoriten, Wiedergabelisten, Diagnosen und Offline-Daten zu speichern. Auf dieser Website wurden keine Cookies, Werbe-Cookies oder Drittanbieter-Analysen gefunden.",
    limited:
      "Ohne Einwilligung kann Radiova im Privatmodus laufen. Radio-Wiedergabe funktioniert, aber Einstellungen, Favoriten, eigene Wiedergabelisten, Diagnosen und Offline-Daten werden nach dem Schließen des Tabs nicht gespeichert.",
    accept: "Akzeptieren und fortfahren",
    continuePrivate: "Im Privatmodus fortfahren",
    privacy: "Datenschutzerklärung",
    settings: "Datenschutzeinstellungen",
    review: "Datenschutzauswahl prüfen",
    withdraw: "Einwilligung widerrufen und Daten löschen",
    close: "Schließen",
    confirmClear: "Einwilligung widerrufen und Radiova-Daten aus diesem Browser löschen?",
    cleared: "Einwilligung widerrufen. Lokale Radiova-Daten wurden gelöscht.",
  },
};

type Locale = keyof typeof COPY;

function locale(): Locale {
  const lang = document.documentElement.lang;
  return lang === "uk" || lang === "de" ? lang : "en";
}

function localizedPath(nextLocale: Locale): string {
  const path = window.location.pathname.replace(/^\/(uk|de)(?=\/|$)/, "") || "/";
  if (nextLocale === "en") return path;
  return `/${nextLocale}${path === "/" ? "" : path}`;
}

function unknownState(): ConsentState {
  return {
    version: CONSENT_VERSION,
    status: "unknown",
    necessary: true,
    preferences: false,
    offline: false,
    diagnostics: false,
    decidedAt: null,
  };
}

function readConsentState(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return unknownState();
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION || parsed.status !== "accepted") return unknownState();
    return {
      version: CONSENT_VERSION,
      status: "accepted",
      necessary: true,
      preferences: true,
      offline: true,
      diagnostics: true,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : null,
    };
  } catch {
    return unknownState();
  }
}

function persistAccepted(state: ConsentState): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: state.version, status: state.status, decidedAt: state.decidedAt }),
  );
}

export function getConsentState(): ConsentState {
  return currentState;
}

export function hasConsent(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  return currentState[category];
}

export function isPrivacyMode(): boolean {
  return currentState.status === "declined";
}

export function whenConsentResolved(): Promise<ConsentState> {
  if (currentState.status !== "unknown") return Promise.resolve(currentState);
  if (window.__radiovaConsentResolved) {
    currentState = window.__radiovaConsentResolved.mode === "accepted"
      ? {
          version: CONSENT_VERSION,
          status: "accepted",
          necessary: true,
          preferences: true,
          offline: true,
          diagnostics: true,
          decidedAt: new Date().toISOString(),
        }
      : {
          version: CONSENT_VERSION,
          status: "declined",
          necessary: true,
          preferences: false,
          offline: false,
          diagnostics: false,
          decidedAt: new Date().toISOString(),
        };
    return Promise.resolve(currentState);
  }
  if (!consentPromise) {
    consentPromise = new Promise((resolve) => {
      resolveConsent = resolve;
      window.addEventListener(
        "radiova:consent-resolved",
        (event) => {
          const detail = (event as CustomEvent<ConsentResolvedDetail>).detail;
          currentState = detail.mode === "accepted" ? readConsentState() : {
            version: CONSENT_VERSION,
            status: "declined",
            necessary: true,
            preferences: false,
            offline: false,
            diagnostics: false,
            decidedAt: new Date().toISOString(),
          };
          resolve(currentState);
        },
        { once: true },
      );
    });
  }
  return consentPromise;
}

function resolve(state: ConsentState): void {
  currentState = state;
  const mode: ConsentMode = state.status === "accepted" ? "accepted" : "private";
  window.__radiovaConsentResolved = { mode };
  document.documentElement.dataset["consent"] = state.status;
  document.documentElement.classList.remove("consent-preload-blocked");
  document.body.classList.toggle("consent-blocked", state.status === "unknown");
  document.body.classList.toggle("privacy-mode", state.status === "declined");
  document.dispatchEvent(new CustomEvent("radiova:consent-changed", { detail: state }));
  window.dispatchEvent(new CustomEvent<ConsentResolvedDetail>("radiova:consent-resolved", {
    detail: { mode },
  }));
  resolveConsent?.(state);
  resolveConsent = null;
  consentPromise = null;
}

function focusDialog(dialog: HTMLElement): void {
  const target = dialog.querySelector<HTMLElement>("#consent-title") ?? dialog;
  target.focus();
}

function trapFocus(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key === "Escape") {
    event.preventDefault();
    focusDialog(dialog);
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function updateConsentGateText(gate: HTMLElement, nextLocale: Locale): void {
  const text = COPY[nextLocale];
  const privacyHref = nextLocale === "en" ? "/privacy" : `/${nextLocale}/privacy`;
  const title = gate.querySelector<HTMLElement>("#consent-title");
  const description = gate.querySelector<HTMLElement>("#consent-description");
  const limited = gate.querySelector<HTMLElement>("#consent-limited");
  const privacy = gate.querySelector<HTMLAnchorElement>("#consent-privacy-link");
  const accept = gate.querySelector<HTMLButtonElement>("#consent-accept");
  const continuePrivate = gate.querySelector<HTMLButtonElement>("#consent-continue-private");
  const switcher = gate.querySelector<HTMLElement>("#consent-language-switcher");
  if (title) title.textContent = text.title;
  if (description) description.textContent = text.description;
  if (limited) limited.textContent = text.limited;
  if (privacy) {
    privacy.href = privacyHref;
    privacy.textContent = text.privacy;
  }
  if (accept) accept.textContent = text.accept;
  if (continuePrivate) continuePrivate.textContent = text.continuePrivate;
  if (switcher) switcher.setAttribute("aria-label", text.language);
  gate.querySelectorAll<HTMLAnchorElement>("[data-consent-locale]").forEach((link) => {
    const linkLocale = link.dataset["consentLocale"] as Locale | undefined;
    if (!linkLocale) return;
    link.href = localizedPath(linkLocale);
    if (linkLocale === nextLocale) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function renderConsentGate(): HTMLElement {
  const currentLocale = locale();
  const text = COPY[currentLocale];
  const privacyHref = currentLocale === "en" ? "/privacy" : `/${currentLocale}/privacy`;
  const gate = document.createElement("div");
  gate.id = "consent-gate";
  gate.className = "consent-gate";
  gate.innerHTML = `<div class="consent-backdrop" data-consent-backdrop></div>
    <section class="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-description consent-limited" tabindex="-1">
      <nav class="consent-language-switcher" id="consent-language-switcher" aria-label="${text.language}">
        <a href="${localizedPath("en")}" class="consent-language-switcher__link" data-consent-locale="en">EN</a>
        <a href="${localizedPath("de")}" class="consent-language-switcher__link" data-consent-locale="de">DE</a>
        <a href="${localizedPath("uk")}" class="consent-language-switcher__link" data-consent-locale="uk">UK</a>
      </nav>
      <h2 id="consent-title" tabindex="-1">${text.title}</h2>
      <p id="consent-description">${text.description}</p>
      <p id="consent-limited" class="consent-dialog__muted">${text.limited}</p>
      <p class="consent-dialog__privacy-link"><a id="consent-privacy-link" href="${privacyHref}">${text.privacy}</a></p>
      <div class="consent-dialog__actions">
        <button id="consent-accept" class="button button--primary" type="button">${text.accept}</button>
        <button id="consent-continue-private" class="button button--secondary" type="button">${text.continuePrivate}</button>
      </div>
    </section>`;
  updateConsentGateText(gate, currentLocale);
  return gate;
}

export function initConsentGate(): void {
  currentState = readConsentState();
  document.documentElement.dataset["consent"] = currentState.status;
  if (currentState.status === "accepted") {
    document.documentElement.classList.remove("consent-preload-blocked");
    return;
  }

  document.body.classList.add("consent-blocked");
  const gate = renderConsentGate();
  document.body.append(gate);

  const dialog = gate.querySelector<HTMLElement>(".consent-dialog");
  const accept = gate.querySelector<HTMLButtonElement>("#consent-accept");
  const continuePrivate = gate.querySelector<HTMLButtonElement>("#consent-continue-private");
  if (!dialog || !accept || !continuePrivate) return;

  const removeGate = (): void => {
    gate.remove();
  };

  gate.querySelectorAll<HTMLAnchorElement>("[data-consent-locale]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const nextLocale = link.dataset["consentLocale"] as Locale | undefined;
      if (!nextLocale) return;
      document.documentElement.lang = nextLocale;
      const nextPath = localizedPath(nextLocale);
      window.history.pushState({}, "", nextPath + window.location.search + window.location.hash);
      updateConsentGateText(gate, nextLocale);
      focusDialog(dialog);
    });
  });

  accept.addEventListener("click", () => {
    accept.disabled = true;
    continuePrivate.disabled = true;
    const accepted: ConsentState = {
      version: CONSENT_VERSION,
      status: "accepted",
      necessary: true,
      preferences: true,
      offline: true,
      diagnostics: true,
      decidedAt: new Date().toISOString(),
    };
    persistAccepted(accepted);
    removeGate();
    resolve(accepted);
  });

  continuePrivate.addEventListener("click", () => {
    accept.disabled = true;
    continuePrivate.disabled = true;
    const declined: ConsentState = {
      version: CONSENT_VERSION,
      status: "declined",
      necessary: true,
      preferences: false,
      offline: false,
      diagnostics: false,
      decidedAt: new Date().toISOString(),
    };
    removeGate();
    resolve(declined);
  });

  gate.addEventListener("pointerdown", (event) => {
    if (event.target instanceof HTMLElement && event.target.hasAttribute("data-consent-backdrop")) {
      event.preventDefault();
      dialog.classList.remove("is-attention");
      void dialog.offsetWidth;
      dialog.classList.add("is-attention");
      focusDialog(dialog);
    }
  });
  document.addEventListener("keydown", (event) => {
    trapFocus(event, dialog);
  }, true);
  window.setTimeout(() => {
    focusDialog(dialog);
  }, 0);
}

export async function clearRadiovaStorage(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("radiova-vol");
    localStorage.removeItem("radiova-muted");
    localStorage.removeItem("radiova-lang");
    localStorage.removeItem("radiova-stream-reports");
  } catch {
    // Storage may be unavailable.
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => {
      return registration.unregister();
    }));
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => {
      return caches.delete(key);
    }));
  }

  if ("indexedDB" in window) {
    await new Promise<void>((resolveDelete) => {
      const request = indexedDB.deleteDatabase("radiova");
      request.onsuccess = () => {
        resolveDelete();
      };
      request.onerror = () => {
        resolveDelete();
      };
      request.onblocked = () => {
        resolveDelete();
      };
    });
  }
}

export async function withdrawConsent(): Promise<void> {
  await clearRadiovaStorage();
  currentState = unknownState();
}

export function openPrivacySettings(): void {
  const text = COPY[locale()];
  const existing = document.getElementById("privacy-settings-dialog");
  if (existing) existing.remove();

  const gate = document.createElement("div");
  gate.id = "privacy-settings-dialog";
  gate.className = "consent-gate consent-gate--settings";
  gate.innerHTML = `<div class="consent-backdrop" data-consent-backdrop></div>
    <section class="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-settings-title" aria-describedby="privacy-settings-description" tabindex="-1">
      <h2 id="privacy-settings-title" tabindex="-1">${text.settings}</h2>
      <p id="privacy-settings-description">${text.description}</p>
      <p class="consent-dialog__muted">${text.limited}</p>
      <div class="consent-dialog__actions">
        <button id="privacy-withdraw" class="button button--secondary" type="button">${text.withdraw}</button>
        <button id="privacy-close" class="button button--primary" type="button">${text.close}</button>
      </div>
      <p id="privacy-settings-status" class="consent-dialog__status" aria-live="polite"></p>
    </section>`;
  document.body.append(gate);

  const dialog = gate.querySelector<HTMLElement>(".consent-dialog");
  const close = gate.querySelector<HTMLButtonElement>("#privacy-close");
  const withdraw = gate.querySelector<HTMLButtonElement>("#privacy-withdraw");
  const status = gate.querySelector<HTMLElement>("#privacy-settings-status");
  if (!dialog || !close || !withdraw) return;

  close.addEventListener("click", () => {
    gate.remove();
  });
  withdraw.addEventListener("click", () => {
    if (!window.confirm(text.confirmClear)) return;
    withdraw.disabled = true;
    void withdrawConsent().then(() => {
      if (status) status.textContent = text.cleared;
      window.location.reload();
    });
  });
  gate.addEventListener("pointerdown", (event) => {
    if (event.target instanceof HTMLElement && event.target.hasAttribute("data-consent-backdrop")) {
      event.preventDefault();
      focusDialog(dialog);
    }
  });
  document.addEventListener("keydown", (event) => {
    trapFocus(event, dialog);
  }, true);
  window.setTimeout(() => {
    focusDialog(dialog);
  }, 0);
}
