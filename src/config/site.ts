/** Site-wide configuration constants. */
export const SITE = {
  title: 'Radiova',
  description: 'Radiova – listen to radio from around the world',
  url: 'https://radiova-app.github.io',
  sourceUrl: 'https://github.com/radiova-app/radiova-app.github.io',
  stationsUrl: 'https://raw.githubusercontent.com/radiova-app/radiova-stations/master',
  releasesUrl:
    'https://github.com/radiova-app/radiova-releases/releases/latest/download/latest.json',
  author: 'Radiova',
  appName: 'Radiova',
  appNameLong: 'Radiova Radio Player',
  appDescription: 'Listen to radio stations from around the world',
} as const;

/** Navigation menu items with localised labels. */
export const NAV = [
  { href: '/', label: 'Home', labelUk: 'Головна', labelDe: 'Start' },
  { href: '/playlists', label: 'Playlists', labelUk: 'Плейлисти', labelDe: 'Playlists' },
  { href: '/downloads', label: 'Downloads', labelUk: 'Завантаження', labelDe: 'Downloads' },
  { href: '/about', label: 'About', labelUk: 'Про нас', labelDe: 'Über uns' },
  { href: '/help', label: 'Help', labelUk: 'Допомога', labelDe: 'Hilfe' },
  { href: '/privacy', label: 'Privacy', labelUk: 'Конфіденційність', labelDe: 'Datenschutz' },
] as const;

/** Playlist tab labels in all supported locales. */
export const PLAYLIST_LABELS = {
  uk: { en: 'Ukrainian', uk: 'Українські', de: 'Ukrainisch' },
  en: { en: 'English', uk: 'Англійські', de: 'Englisch' },
  de: { en: 'German', uk: 'Німецькі', de: 'Deutsch' },
  global: { en: 'Global', uk: 'Світові', de: 'Global' },
  all: { en: 'All', uk: 'Всі', de: 'Alle' },
  favorites: { en: 'Favorites', uk: 'Улюблені', de: 'Favoriten' },
} as const;

/** Locale identifier used for playlist filtering. */
export type PlaylistLocale = keyof typeof PLAYLIST_LABELS;
