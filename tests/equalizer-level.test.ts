/**
 * Verifies the Web Audio level-meter math: RMS, peak, clamping, and
 * attack/release smoothing used by the equalizer's meter display.
 *
 * These are pure functions — no DOM, no IndexedDB, no AudioContext.
 * They run in any Vitest environment.
 *
 * Related module: src/services/level-meter.ts
 */
import { describe, expect, it } from "vitest";
import {
  calculateLevelFromTimeDomainData,
  clampLevel,
  smoothLevel,
} from "../src/services/level-meter";

describe("equalizer level calculation", () => {
  /**
   * Uint8Array([128, 128, ...]) is the silence sentinel from
   * AnalyserNode.getByteTimeDomainData — every sample is exactly 128
   * (the centre value), so RMS and peak must be zero.
   */
  it("calculates silence as zero RMS and peak", () => {
    const level = calculateLevelFromTimeDomainData(
      new Uint8Array([128, 128, 128, 128]),
    );

    expect(level.rms).toBe(0);
    expect(level.peak).toBe(0);
  });

  /**
   * Samples [128, 192, 64, 128] correspond to normalised deltas
   * [0, +0.5, -0.5, 0]. RMS = sqrt((0+0.25+0.25+0)/4) = sqrt(0.125).
   * Peak = max(0.5, 0.5, 0) = 0.5.
   */
  it("calculates RMS and peak from time-domain samples", () => {
    const level = calculateLevelFromTimeDomainData(
      new Uint8Array([128, 192, 64, 128]),
    );

    expect(level.rms).toBeCloseTo(Math.sqrt((0 + 0.25 + 0.25 + 0) / 4));
    expect(level.peak).toBeCloseTo(0.5);
  });

  /**
   * clampLevel must map negative → 0, over-1 → 1, NaN → 0.
   * This protects the CSS width binding from producing invalid values.
   */
  it("clamps levels to the normalized range", () => {
    expect(clampLevel(-1)).toBe(0);
    expect(clampLevel(0.42)).toBe(0.42);
    expect(clampLevel(2)).toBe(1);
    expect(clampLevel(Number.NaN)).toBe(0);
  });

  /**
   * Attack/release asymmetry: meter bars rise quickly (attack) and fall
   * slowly (release), mimicking analogue VU needle behaviour.
   * smoothLevel(current=0.1, target=0.9) attacks toward 0.9.
   * smoothLevel(current=0.9, target=0.1) releases toward 0.1.
   * The attack result must be closer to the target than the release result
   * after one step, proving that attack > release in per-frame effect.
   */
  it("uses faster attack than release", () => {
    // Attack: 0.1 → 0.9, release: 0.9 → 0.1
    const attacked = smoothLevel(0.1, 0.9);
    const released = smoothLevel(0.9, 0.1);

    expect(attacked).toBeCloseTo(0.54);
    expect(released).toBeCloseTo(0.804);
  });
});
