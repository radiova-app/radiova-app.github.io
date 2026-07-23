import { resetAllData } from '../services/db';
import { loadLocale, t } from '../services/i18n';
import { clearRadiovaStorage, openPrivacySettings, whenConsentResolved } from '../services/consent';

async function resetData(): Promise<void> {
  if (!window.confirm(t('privacy.resetConfirm'))) return;
  await resetAllData();
  await clearRadiovaStorage();
  try {
    localStorage.removeItem('radiova-vol');
    localStorage.removeItem('radiova-muted');
    localStorage.removeItem('radiova-lang');
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  const status = document.getElementById('reset-status');
  if (status) status.textContent = t('privacy.resetDone');
}

document.addEventListener('DOMContentLoaded', () => {
  void whenConsentResolved().then(() => {
    loadLocale();
    document.getElementById('reset-data-btn')?.addEventListener('click', () => { void resetData(); });
    document.querySelectorAll('.privacy-settings-action').forEach((button) => {
      button.addEventListener('click', openPrivacySettings);
    });
  });
});
