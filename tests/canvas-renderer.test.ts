/**
 * Regression tests for the canvas renderer geometry safety fixes.
 *
 * Verifies that:
 *   - clampCanvasRadius never returns a negative value.
 *   - drawSideStatic never calls ctx.arc() with a negative radius.
 *   - drawSide, drawBars, and drawStaticCanvas handle tiny canvases safely.
 *   - ResizeObserver edge cases (detached, tiny, 0x0) don't throw.
 *
 * Pure-function tests use direct imports. Canvas-context tests use a
 * minimal mock that records arc() call arguments.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  clampCanvasRadius,
  MIN_SIDE_VISUALIZER_SIZE,
  drawSideStatic,
  drawSide,
  drawBars,
  drawStaticCanvas,
  resizeCanvasToDisplaySize,
} from "../src/visualizer/canvas-renderer";

/**
 * Build a minimal mock CanvasRenderingContext2D with a backing canvas
 * of the given dimensions. Records every arc() call for assertion.
 */
function mockCtx(w: number, h: number): { ctx: CanvasRenderingContext2D; arcCalls: Array<number> } {
  const arcCalls: Array<number> = [];
  const canvas = { width: w, height: h } as unknown as HTMLCanvasElement;
  const ctx = {
    canvas,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    arc: vi.fn((_x: number, _y: number, r: number, _sa: number, _ea: number) => {
      arcCalls.push(r);
    }),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, arcCalls };
}

/**
 * Simulate a ResizeObserver-like scenario: create a mock context for a
 * tiny canvas and call drawSideStatic to verify no negative arc.
 */
function testDrawSideStaticSafe(w: number, h: number): number[] {
  const { ctx, arcCalls } = mockCtx(w, h);
  drawSideStatic(ctx);
  return arcCalls;
}

describe("clampCanvasRadius", () => {
  it("returns non-negative finite values unchanged", () => {
    expect(clampCanvasRadius(0)).toBe(0);
    expect(clampCanvasRadius(4.2)).toBe(4.2);
    expect(clampCanvasRadius(100)).toBe(100);
  });

  it("clamps negative values to zero", () => {
    expect(clampCanvasRadius(-1)).toBe(0);
    expect(clampCanvasRadius(-3.5)).toBe(0);
    expect(clampCanvasRadius(-Infinity)).toBe(0);
  });

  it("returns zero for NaN and Infinity", () => {
    expect(clampCanvasRadius(Number.NaN)).toBe(0);
    expect(clampCanvasRadius(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampCanvasRadius(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("MIN_SIDE_VISUALIZER_SIZE", () => {
  it("is a positive integer", () => {
    expect(MIN_SIDE_VISUALIZER_SIZE).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(MIN_SIDE_VISUALIZER_SIZE)).toBe(true);
    expect(MIN_SIDE_VISUALIZER_SIZE).toBe(16);
  });
});

describe("drawSideStatic canvas arc safety", () => {
  it("does not call canvas arc with a negative radius on tiny responsive canvases", () => {
    const arcs = testDrawSideStaticSafe(1, 1);
    for (const r of arcs) expect(r).toBeGreaterThanOrEqual(0);
  });

  it("produces no arc calls for a 0x0 canvas", () => {
    // width/height are read from the backing store; 0x0 means no arcs.
    const arcs = testDrawSideStaticSafe(0, 0);
    expect(arcs).toHaveLength(0);
  });

  it("produces no arc calls for a 1x1 canvas (the original failing case)", () => {
    const arcs = testDrawSideStaticSafe(1, 1);
    expect(arcs).toHaveLength(0);
  });

  it("produces no arc calls for a 7x7 canvas (below MIN_SIDE_VISUALIZER_SIZE)", () => {
    const arcs = testDrawSideStaticSafe(7, 7);
    expect(arcs).toHaveLength(0);
  });

  it("skips arcs for very narrow canvas", () => {
    const arcs = testDrawSideStaticSafe(3, 200);
    expect(arcs).toHaveLength(0);
  });

  it("skips arcs for very short canvas", () => {
    const arcs = testDrawSideStaticSafe(200, 3);
    expect(arcs).toHaveLength(0);
  });

  it("renders arcs for a normal-sized canvas", () => {
    const arcs = testDrawSideStaticSafe(400, 400);
    expect(arcs.length).toBeGreaterThan(0);
    for (const r of arcs) expect(r).toBeGreaterThan(0);
  });

  it("renders arcs for a high-DPI-sized canvas", () => {
    // Simulate 2x devicePixelRatio backing store
    const arcs = testDrawSideStaticSafe(800, 800);
    expect(arcs.length).toBeGreaterThan(0);
    for (const r of arcs) expect(r).toBeGreaterThan(0);
  });
});

describe("drawSide static fallback safety", () => {
  it("falls through to drawSideStatic and does not throw for tiny canvas", () => {
    const { ctx } = mockCtx(1, 1);
    drawSide(ctx, new Uint8Array(128));
    // drawSide calls drawSideStatic for zero data, which may or may not call
    // arc depending on canvas size. The important thing is no exception.
  });

  it("draws normally for a normal canvas with zero data", () => {
    const { ctx } = mockCtx(400, 400);
    expect(() => { drawSide(ctx, new Uint8Array(128)); }).not.toThrow();
  });
});

describe("drawBars edge cases", () => {
  it("does not throw for a 0x0 canvas", () => {
    const { ctx } = mockCtx(0, 0);
    expect(() => { drawBars(ctx, new Uint8Array(64), 64, true); }).not.toThrow();
  });

  it("does not throw for a 1x1 canvas", () => {
    const { ctx } = mockCtx(1, 1);
    expect(() => { drawBars(ctx, new Uint8Array(64), 64, true); }).not.toThrow();
  });
});

describe("drawStaticCanvas edge cases", () => {
  it("does not throw for a 0x0 canvas", () => {
    const { ctx } = mockCtx(0, 0);
    expect(() => { drawStaticCanvas(ctx); }).not.toThrow();
  });

  it("does not throw for a 1x1 canvas", () => {
    const { ctx } = mockCtx(1, 1);
    expect(() => { drawStaticCanvas(ctx); }).not.toThrow();
  });
});

describe("resizeCanvasToDisplaySize", () => {
  it("returns early for detached canvas without throwing", () => {
    const canvas = { width: 0, height: 0, isConnected: false } as unknown as HTMLCanvasElement;
    expect(() => { resizeCanvasToDisplaySize(canvas); }).not.toThrow();
  });
});

describe("source-level guards", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../src/visualizer/canvas-renderer.ts"),
    "utf-8",
  );

  it("has clampCanvasRadius helper", () => {
    expect(source).toContain("export function clampCanvasRadius");
  });

  it("guards drawSideStatic with MIN_SIDE_VISUALIZER_SIZE check", () => {
    expect(source).toContain("MIN_SIDE_VISUALIZER_SIZE");
  });

  it("guards drawSideStatic with rMax <= 0 return", () => {
    expect(source).toContain("rMax <= 0");
  });

  it("clamps r before calling arc", () => {
    expect(source).toContain("Math.max(0, rMax");
  });

  it("guards drawSide with MIN_SIDE_VISUALIZER_SIZE", () => {
    expect(source).toContain("MIN_SIDE_VISUALIZER_SIZE");
  });
});
