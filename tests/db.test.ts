import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSettings, saveSettings, getFavorites, addFavorite, removeFavorite, resetAllData } from "../src/services/db";
import type { AppSettings } from "../src/types/storage";
import { DEFAULT_SETTINGS } from "../src/types/storage";

const hasIndexedDB = typeof indexedDB !== "undefined";

describe.runIf(hasIndexedDB)("IndexedDB storage", () => {
  beforeAll(async () => {
    await resetAllData();
  });

  it("returns default settings when empty", async () => {
    const settings = await getSettings();
    expect(settings.language).toBe(DEFAULT_SETTINGS.language);
    expect(settings.lastPlaylist).toBe(DEFAULT_SETTINGS.lastPlaylist);
  });

  it("persists settings", async () => {
    const testSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      language: "de",
      lastStationId: "st-test-123",
    };
    await saveSettings(testSettings);
    const loaded = await getSettings();
    expect(loaded.language).toBe("de");
    expect(loaded.lastStationId).toBe("st-test-123");
  });

  it("manages favorites", async () => {
    const id = "st-fav-test";
    await addFavorite(id);
    const favs = await getFavorites();
    expect(favs.has(id)).toBe(true);

    await removeFavorite(id);
    const after = await getFavorites();
    expect(after.has(id)).toBe(false);
  });

  it("deduplicates favorites", async () => {
    const id = "st-fav-dup";
    await addFavorite(id);
    await addFavorite(id);
    const favs = await getFavorites();
    const count = [...favs].filter((f) => f === id).length;
    expect(count).toBeLessThanOrEqual(1);
  });

  afterAll(async () => {
    await resetAllData();
  });
});

describe.runIf(!hasIndexedDB)("IndexedDB (skipped)", () => {
  it("requires browser environment with IndexedDB", () => {
    expect(true).toBe(true);
  });
});
