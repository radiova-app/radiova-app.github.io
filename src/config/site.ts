export const SITE = {
  title: "Radiova",
  description: "Radiova – listen to radio from around the world",
  url: "https://radiova-app.github.io",
  sourceUrl: "https://github.com/radiova-app/radiova-app.github.io",
  releasesUrl:
    "https://github.com/radiova-app/radiova-releases/releases/latest/download/latest.json",
  author: "Radiova",
} as const;

export const NAV = [
  { href: "/", label: "Home", labelUk: "Головна", labelDe: "Start" },
  { href: "/downloads", label: "Downloads", labelUk: "Завантаження", labelDe: "Downloads" },
  { href: "/support", label: "Support", labelUk: "Підтримка", labelDe: "Support" },
  { href: "/privacy", label: "Privacy", labelUk: "Конфіденційність", labelDe: "Datenschutz" },
] as const;
