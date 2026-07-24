/*
Pure level calculation functions from Web Audio AnalyserNode data.
All functions are stateless — the integration layer (equalizer.ts)
owns the runtime meter state (leftRms, rightRms, leftMeterWidth, ...).

Attack and release smoothing uses two fixed factors:
  - rising  (target > current): factor 0.55  — fast attack
  - falling (target < current): factor 0.12  — slow release
This gives a natural meter feel where peaks are caught quickly
and the bar settles slowly.
*/

/** A single RMS and peak reading from analyser data. */
export interface LevelSample {
  rms: number;
  peak: number;
}

/**
 * Clamp a level value to the [0, 1] range.
 * Non-finite values return 0.
 * @param value - The raw level value.
 * @returns The clamped value in [0, 1].
 */
export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Calculate RMS and peak from a Uint8Array of time-domain data.
 * Values are normalised from [0..255] to [-1..1] before calculation.
 * @param dataArray - Raw time-domain analyser data.
 * @returns RMS and peak levels.
 */
export function calculateLevelFromTimeDomainData(dataArray: Uint8Array): LevelSample {
  if (dataArray.length === 0) return { rms: 0, peak: 0 };
  let sum = 0;
  let peak = 0;
  for (const value of dataArray) {
    const normalized = (value - 128) / 128;
    const abs = Math.abs(normalized);
    sum += normalized * normalized;
    if (abs > peak) peak = abs;
  }
  return {
    rms: clampLevel(Math.sqrt(sum / dataArray.length)),
    peak: clampLevel(peak),
  };
}

/**
 * Smooth a level value toward a target using attack/release factors.
 * Rising values use 0.55 (fast attack), falling use 0.12 (slow release).
 * @param current - The current smoothed level.
 * @param target - The target level to approach.
 * @returns The new smoothed level.
 */
export function smoothLevel(current: number, target: number): number {
  const clampedCurrent = clampLevel(current);
  const clampedTarget = clampLevel(target);
  const factor = clampedTarget > clampedCurrent ? 0.55 : 0.12;
  return clampLevel(clampedCurrent + (clampedTarget - clampedCurrent) * factor);
}

/**
 * Return the maximum value in a Uint8Array.
 * @param dataArray - The data array to scan.
 * @returns The maximum byte value.
 */
export function maxBin(dataArray: Uint8Array): number {
  let max = 0;
  for (const value of dataArray) {
    if (value > max) max = value;
  }
  return max;
}

/**
 * Compute the target meter width from a LevelSample.
 * Weights RMS by 2.4 and peak by 0.72, then takes the max.
 * @param sample - The RMS/peak sample.
 * @returns The target level for meter display.
 */
export function meterTarget(sample: LevelSample): number {
  return clampLevel(Math.max(sample.rms * 2.4, sample.peak * 0.72));
}

/**
 * Read time-domain data from an AnalyserNode and return RMS/peak.
 * Returns zero levels when analyser is null.
 * @param analyser - The Web Audio AnalyserNode, or null.
 * @returns The RMS/peak sample.
 */
export function readAnalyserLevel(analyser: AnalyserNode | null): LevelSample {
  if (!analyser) return { rms: 0, peak: 0 };
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  return calculateLevelFromTimeDomainData(data);
}
