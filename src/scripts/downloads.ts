import { getPWAState, isStandalone, onPWAStateChange, promptInstall } from '../services/pwa';

function updateInstallButton(button: HTMLElement): void {
  button.classList.toggle('is-hidden', isStandalone() || getPWAState() !== 'installable');
}

document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('pwa-install-page');
  if (!button) return;
  updateInstallButton(button);
  onPWAStateChange(() => { updateInstallButton(button); });
  button.addEventListener('click', () => { void promptInstall(); });
});
