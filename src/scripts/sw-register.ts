import { hasConsent, whenConsentResolved } from '../services/consent';

/**
 * Register the service worker after consent is resolved.
 * Registration happens once on load only when 'offline' consent is granted.
 * On controllerchange the page reloads to activate the new worker.
 */
void whenConsentResolved().then(() => {
  if ('serviceWorker' in navigator && hasConsent('offline')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed silently (e.g., HTTP without HTTPS)
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
});
