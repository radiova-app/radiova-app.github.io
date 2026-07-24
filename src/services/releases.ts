import type { Release } from "../types/release";
import { SITE } from "../config/site";

/**
 * Fetch the latest release info from the releases repository.
 * @returns The Release object, or null on failure.
 */
export async function fetchLatestRelease(): Promise<Release | null> {
  try {
    const response = await fetch(SITE.releasesUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch release: ${String(response.status)}`);
      return null;
    }
    const data: unknown = await response.json();
    return data as Release;
  } catch (error) {
    console.warn("Failed to fetch latest release:", error);
    return null;
  }
}
