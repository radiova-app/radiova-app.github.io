import { hasConsent, whenConsentResolved } from '../services/consent';

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
