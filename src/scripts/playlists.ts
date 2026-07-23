import { getCustomPlaylist, getCustomPlaylists, deleteCustomPlaylist, renameCustomPlaylist, saveCustomPlaylist } from '../services/db';
import { buildM3U, parseM3U, validateM3U } from '../services/m3u';
import { fetchManifest, getPlaylistEntry } from '../services/playlist';
import { loadLocale, t } from '../services/i18n';
import { whenConsentResolved } from '../services/consent';
import type { CustomPlaylist } from '../types/storage';

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setStatus(message = ''): void {
  const status = $('custom-playlists-status');
  if (status) status.textContent = message;
}

function createButton(label: string, action: string, name: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card__action';
  button.dataset['action'] = action;
  button.dataset['name'] = name;
  button.textContent = label;
  return button;
}

function renderCustomPlaylist(playlist: CustomPlaylist): HTMLElement {
  const item = document.createElement('article');
  item.className = 'custom-playlist-item';

  const content = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'card__title';
  title.textContent = playlist.name;
  const meta = document.createElement('p');
  meta.className = 'card__text';
  meta.textContent = t('custom.stationCount', { count: playlist.stations.length });
  content.append(title, meta);

  const actions = document.createElement('div');
  actions.className = 'playlist-card__actions';
  actions.append(
    createButton(t('custom.export'), 'export', playlist.name),
    createButton(t('custom.rename'), 'rename', playlist.name),
    createButton(t('custom.delete'), 'delete', playlist.name),
  );

  item.append(content, actions);
  return item;
}

async function renderCustomPlaylists(): Promise<void> {
  const list = $('custom-playlists-list');
  if (!list) return;
  const playlists = await getCustomPlaylists();
  list.replaceChildren();

  if (playlists.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'content-page__text';
    empty.textContent = t('custom.empty');
    list.append(empty);
    return;
  }

  for (const playlist of playlists) list.append(renderCustomPlaylist(playlist));
}

async function createPlaylist(): Promise<void> {
  const input = $('custom-playlist-name') as HTMLInputElement | null;
  const name = input?.value.trim() ?? '';
  if (!name) {
    setStatus(t('custom.nameRequired'));
    input?.focus();
    return;
  }
  if (await getCustomPlaylist(name)) {
    setStatus(t('custom.exists'));
    return;
  }
  await saveCustomPlaylist(name, []);
  if (input) input.value = '';
  setStatus(t('custom.created'));
  await renderCustomPlaylists();
}

async function importPlaylist(file: File): Promise<void> {
  const content = await file.text();
  if (!validateM3U(content)) {
    setStatus(t('custom.invalidFile'));
    return;
  }
  const name = file.name.replace(/\.m3u8?$/i, '').trim() || t('custom.importedName');
  if (await getCustomPlaylist(name)) {
    setStatus(t('custom.exists'));
    return;
  }
  const stations = parseM3U(content);
  await saveCustomPlaylist(name, stations);
  setStatus(t('custom.imported', { count: stations.length }));
  await renderCustomPlaylists();
}

async function handlePlaylistAction(target: HTMLElement): Promise<void> {
  const action = target.dataset['action'];
  const name = target.dataset['name'];
  if (!action || !name) return;

  if (action === 'export') {
    const playlist = await getCustomPlaylist(name);
    if (!playlist) return;
    const blob = new Blob([buildM3U(playlist.stations)], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${playlist.name}.m3u`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (action === 'rename') {
    const nextName = window.prompt(t('custom.renamePrompt'), name)?.trim();
    if (!nextName || nextName === name) return;
    const renamed = await renameCustomPlaylist(name, nextName);
    setStatus(renamed ? t('custom.renamed') : t('custom.exists'));
    if (renamed) await renderCustomPlaylists();
    return;
  }

  if (action === 'delete' && window.confirm(t('custom.deleteConfirm', { name }))) {
    await deleteCustomPlaylist(name);
    setStatus(t('custom.deleted'));
    await renderCustomPlaylists();
  }
}

async function renderManifestInfo(): Promise<void> {
  const manifest = await fetchManifest();
  if (!manifest) return;
  for (const locale of ['uk', 'en', 'de', 'global', 'all']) {
    const entry = getPlaylistEntry(manifest, locale);
    const info = $(`playlist-info-${locale}`);
    if (!entry || !info) continue;
    const date = new Date(entry.generatedAt).toLocaleDateString();
    info.textContent = `${t('playlists.stationCount', { count: entry.stationCount })} · ${t('playlists.endpointCount', { count: entry.endpointCount })} · ${t('playlists.generated', { date })}`;
  }
}

async function copyRawUrl(button: HTMLElement): Promise<void> {
  const url = button.dataset['url'];
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    setStatus(t('playlists.copied'));
  } catch {
    setStatus(t('playlists.copyFailed'));
  }
}

async function init(): Promise<void> {
  loadLocale();
  const form = $('custom-playlist-form') as HTMLFormElement | null;
  const importButton = $('import-m3u-btn');
  const importInput = $('import-m3u-input') as HTMLInputElement | null;

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    void createPlaylist();
  });
  importButton?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (file) void importPlaylist(file);
    importInput.value = '';
  });
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]');
    if (action) void handlePlaylistAction(action);
    const copy = target.closest<HTMLElement>('.copy-url-btn');
    if (copy) void copyRawUrl(copy);
  });

  await Promise.all([renderCustomPlaylists(), renderManifestInfo()]);
}

document.addEventListener('DOMContentLoaded', () => { void whenConsentResolved().then(() => init()); });
