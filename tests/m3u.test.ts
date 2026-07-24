/**
 * Protects the M3U playlist parser round-trip: parse, validate, build.
 *
 * These tests use inline fixture strings rather than external files so
 * they are fully deterministic and require no network or filesystem setup.
 *
 * Key edge cases covered: malformed input, empty input, missing header,
 * duplicate URL deduplication, and logo preservation during station
 * endpoint grouping (first-vs-last wins semantics).
 *
 * Related module: src/services/m3u.ts
 */
import { describe, it, expect } from "vitest";
import type { Station } from "../src/types/station";
import { parseM3U, validateM3U, buildM3U } from "../src/services/m3u";

/**
 * Two stations where Station 1 has two endpoints and Station 2 has one.
 * Station 2 includes a tvg-logo and a group-title. Only Station 1 has
 * codec/bitrate metadata on its endpoints.
 */
const SAMPLE_VALID = `#EXTM3U
#EXTINF:-1 tvg-id="st-test-1" radio-endpoint-id="ep-1" radio-codec="mp3" group-title="en",Test Radio 1
http://example.com/stream1.mp3
#EXTINF:-1 tvg-id="st-test-1" radio-endpoint-id="ep-2" radio-codec="aac" radio-bitrate="128" group-title="en",Test Radio 1
http://example.com/stream2.aac
#EXTINF:-1 tvg-id="st-test-2" tvg-logo="http://example.com/logo.png" group-title="uk",Test Radio 2
http://example.com/stream3.mp3`;

/**
 * EXTINF line is present but does not contain valid tvg-id/URL metadata.
 * validateM3U should reject because it cannot parse a station id.
 */
const SAMPLE_MALFORMED = `#EXTM3U
Some random text
http://example.com/stream.mp3`;

/** Only the header — no stations. validateM3U must reject. */
const SAMPLE_EMPTY = `#EXTM3U`;

/**
 * EXTINF lines appear but the mandatory #EXTM3U header is missing.
 * The IPTV-format spec requires the header as the first line.
 */
const SAMPLE_NO_HEADER = `#EXTINF:-1,Test
http://example.com/stream.mp3`;

describe("validateM3U", () => {
  it("accepts valid M3U", () => {
    expect(validateM3U(SAMPLE_VALID)).toBe(true);
  });

  it("rejects malformed M3U (missing EXTINF)", () => {
    expect(validateM3U(SAMPLE_MALFORMED)).toBe(false);
  });

  it("rejects empty M3U", () => {
    expect(validateM3U(SAMPLE_EMPTY)).toBe(false);
  });

  it("rejects content without #EXTM3U header", () => {
    expect(validateM3U(SAMPLE_NO_HEADER)).toBe(false);
  });
});

describe("parseM3U", () => {
  it("parses stations with multiple endpoints", () => {
    const stations = parseM3U(SAMPLE_VALID);
    expect(stations).toHaveLength(2);

    const st1 = stations.find((s) => s.id === "st-test-1");
    expect(st1).toBeDefined();
    expect(st1?.endpoints).toHaveLength(2);
    expect(st1?.name).toBe("Test Radio 1");

    const st2 = stations.find((s) => s.id === "st-test-2");
    expect(st2).toBeDefined();
    expect(st2?.endpoints).toHaveLength(1);
    expect(st2?.logo).toBe("http://example.com/logo.png");
    expect(st2?.locale).toBe("uk");
  });

  it("parses endpoint metadata", () => {
    const stations = parseM3U(SAMPLE_VALID);
    const st1 = stations.find((s) => s.id === "st-test-1") as Station;
    expect(st1.endpoints[0]?.codec).toBe("mp3");
    expect(st1.endpoints[1]?.codec).toBe("aac");
    expect(st1.endpoints[1]?.bitrate).toBe(128);
  });

  /**
   * When the same station id appears twice with identical URLs, only one
   * endpoint should survive. This prevents visible station duplication in
   * the UI when a playlist contains redundant entries.
   */
  it("deduplicates identical URLs", () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-id="st-test",Test
http://example.com/stream.mp3
#EXTINF:-1 tvg-id="st-test",Test
http://example.com/stream.mp3`;
    const stations = parseM3U(content);
    expect(stations).toHaveLength(1);
    expect(stations[0]?.endpoints).toHaveLength(1);
  });

  it("handles empty input", () => {
    expect(parseM3U("")).toHaveLength(0);
  });
});

/**
 * The parser groups multiple EXTINF entries with the same tvg-id into a
 * single Station object. Logo is set from the *first* non-empty tvg-logo
 * encountered, preserving the convention that the primary stream carries
 * the logo. Covering three edge cases: no logo → later has logo, logo →
 * later no logo, and first logo differs from second logo.
 */
describe("logo preservation during grouping", () => {
  /**
   * First endpoint has no tvg-logo, second has one. The parser must
   * keep the non-empty logo from the second (last) entry.
   */
  it("keeps logo when first endpoint has no logo but second does", () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-id="test-station" group-title="en",Test Station
http://example.com/stream1.mp3
#EXTINF:-1 tvg-id="test-station" tvg-logo="http://example.com/logo.png" group-title="en",Test Station
http://example.com/stream2.mp3`;
    const stations = parseM3U(content);
    expect(stations).toHaveLength(1);
    expect(stations[0]?.logo).toBe("http://example.com/logo.png");
  });

  /**
   * First endpoint has a logo, second has none. The parser must NOT
   * overwrite the existing logo with undefined/empty.
   */
  it("does not overwrite existing logo with empty one", () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-id="test-station" tvg-logo="http://example.com/logo.png" group-title="en",Test Station
http://example.com/stream1.mp3
#EXTINF:-1 tvg-id="test-station" group-title="en",Test Station
http://example.com/stream2.mp3`;
    const stations = parseM3U(content);
    expect(stations).toHaveLength(1);
    expect(stations[0]?.logo).toBe("http://example.com/logo.png");
  });

  /**
   * Both endpoints have different logos. The first one wins — the
   * parser must not replace an existing non-empty logo.
   */
  it("preserves non-empty logo when later endpoint has different logo", () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-id="test-station" tvg-logo="http://example.com/logo1.png" group-title="en",Test Station
http://example.com/stream1.mp3
#EXTINF:-1 tvg-id="test-station" tvg-logo="http://example.com/logo2.png" group-title="en",Test Station
http://example.com/stream2.mp3`;
    const stations = parseM3U(content);
    expect(stations).toHaveLength(1);
    expect(stations[0]?.logo).toBe("http://example.com/logo1.png");
  });

  it("handles real-world tvg-logo with quoted URLs", () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-id="test-station" tvg-logo="http://radio.pervii.com/logo/1403609467.png" group-title="en",Test Station
http://example.com/stream.mp3`;
    const stations = parseM3U(content);
    expect(stations).toHaveLength(1);
    expect(stations[0]?.logo).toBe(
      "http://radio.pervii.com/logo/1403609467.png",
    );
  });
});

describe("buildM3U", () => {
  /**
   * Parsing SAMPLE_VALID, rebuilding via buildM3U, then parsing again
   * must produce the same number of stations and endpoints. This ensures
   * the M3U writer does not corrupt the data.
   */
  it("round-trips valid playlists", () => {
    const stations = parseM3U(SAMPLE_VALID);
    const rebuilt = buildM3U(stations);
    expect(validateM3U(rebuilt)).toBe(true);
    const reparsed = parseM3U(rebuilt);
    expect(reparsed).toHaveLength(stations.length);
    const firstReparsed = reparsed[0];
    const firstOriginal = stations[0];
    expect(firstReparsed).toBeDefined();
    expect(firstOriginal).toBeDefined();
    expect(firstReparsed?.endpoints).toHaveLength(
      firstOriginal?.endpoints.length ?? 0,
    );
  });
});
