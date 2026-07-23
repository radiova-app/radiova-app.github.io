import { resetAllData } from '../services/db';
import { loadLocale, t } from '../services/i18n';

async function resetData(): Promise<void> {
  if (!window.confirm(t('privacy.resetConfirm'))) return;
  await resetAllData();
  try {
    localStorage.removeItem('radiova-vol');
    localStorage.removeItem('radiova-muted');
    localStorage.removeItem('radiova-lang');
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  const status = document.getElementById('reset-data-status');
  if (status) status.textContent = t('privacy.resetDone');
}

document.addEventListener('DOMContentLoaded', () => {
  loadLocale();
  document.getElementById('reset-data-btn')?.addEventListener('click', () => { void resetData(); });
});
