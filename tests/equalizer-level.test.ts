import { describe, expect, it } from "vitest";
import { calculateLevelFromTimeDomainData, clampLevel, smoothLevel } from "../src/services/level-meter";

describe("equalizer level calculation", () => {
  it("calculates silence as zero RMS and peak", () => {
    const level = calculateLevelFromTimeDomainData(new Uint8Array([128, 128, 128, 128]));

    expect(level.rms).toBe(0);
    expect(level.peak).toBe(0);
  });

  it("calculates RMS and peak from time-domain samples", () => {
    const level = calculateLevelFromTimeDomainData(new Uint8Array([128, 192, 64, 128]));

    expect(level.rms).toBeCloseTo(Math.sqrt((0 + 0.25 + 0.25 + 0) / 4));
    expect(level.peak).toBeCloseTo(0.5);
  });

  it("clamps levels to the normalized range", () => {
    expect(clampLevel(-1)).toBe(0);
    expect(clampLevel(0.42)).toBe(0.42);
    expect(clampLevel(2)).toBe(1);
    expect(clampLevel(Number.NaN)).toBe(0);
  });

  it("uses faster attack than release", () => {
    const attacked = smoothLevel(0.1, 0.9);
    const released = smoothLevel(0.9, 0.1);

    expect(attacked).toBeCloseTo(0.54);
    expect(released).toBeCloseTo(0.804);
  });
});
