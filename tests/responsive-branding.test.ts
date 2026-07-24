/**
 * Structural regressions for canonical branding and responsive shell behavior.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (relative: string): string => readFileSync(resolve(root, relative), "utf8");
const appShell = read("src/layouts/AppShell.astro");
const styles = read("src/styles/global.scss");
const appScript = read("src/scripts/app.ts");
const verifier = read("scripts/verify-responsive-branding.mjs");
const brandingManifest = JSON.parse(read("public/assets/branding/branding-manifest.json")) as {
  canonicalSource: string;
  canonicalSourceFilename: string;
  sourceSha256: string;
  generated: Array<{ file: string; width: number; height: number }>;
};

describe("canonical branding", () => {
  it("documents the canonical private source path", () => {
    expect(brandingManifest.canonicalSource).toContain("packages/branding/originals/active.png");
  });

  it("provides the branding manifest", () => {
    expect(existsSync(resolve(root, "public/assets/branding/branding-manifest.json"))).toBe(true);
  });

  it("keeps generated logo lineage tied to the source hash", () => {
    const logo = readFileSync(resolve(root, "public/assets/branding/radiova-logo.png"));
    expect(createHash("sha256").update(logo).digest("hex")).toBe(brandingManifest.sourceSha256);
  });

  it("does not ship the invented favicon SVG", () => {
    expect(existsSync(resolve(root, "public/favicon.svg"))).toBe(false);
  });

  it("uses an image rather than an emoji or Unicode logo", () => {
    expect(appShell).toContain('src="/assets/branding/radiova-logo-48.png"');
    expect(appShell).not.toMatch(/class="(?:emoji|unicode)-logo"/);
  });

  it("does not use an icon font for branding", () => {
    expect(appShell).not.toMatch(/(?:fa-|material-icons).*Radiova/i);
  });

  it("renders one mobile topbar brand and one sidebar brand", () => {
    expect((appShell.match(/class="topbar-brand"/g) ?? []).length).toBe(1);
    expect((appShell.match(/class="sidebar-brand"/g) ?? []).length).toBe(1);
  });

  it("generates every declared branding asset", () => {
    for (const asset of brandingManifest.generated) {
      expect(existsSync(resolve(root, "public", asset.file)), asset.file).toBe(true);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
    }
  });
});

describe("responsive player and shell", () => {
  it("marks Home routes so the compact player starts hidden", () => {
    expect(appShell).toContain('"is-route-hidden": isHomeRoute');
  });

  it("keeps the compact player available on non-Home routes", () => {
    expect(appShell).toContain('id="header-player"');
    expect(styles).not.toMatch(
      /max-width:\s*\$breakpoint-md[\s\S]{0,100}\.header-player\s*{\s*display:\s*none/,
    );
  });

  it("moves the same compact player below the header at narrow widths", () => {
    expect(styles).toContain('"player player"');
    expect(styles).toContain("@media (max-width: 860px)");
  });

  it("does not duplicate compact-player or audio IDs", () => {
    expect((appShell.match(/id="header-player"/g) ?? []).length).toBe(1);
    expect((appShell.match(/id="persistent-audio"/g) ?? []).length).toBe(1);
  });

  it("keeps the desktop sidebar in the left shell column", () => {
    expect(styles).toContain("grid-template-columns: var(--sidebar-collapsed) minmax(0, 1fr)");
    expect(styles).toContain("grid-column: 1");
  });

  it("removes the desktop sidebar column on mobile", () => {
    expect(styles).toContain(".shell:not(.shell-collapsed) .shell-body");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(styles).toMatch(/\.sidebar\s*{[\s\S]*?position:\s*fixed/);
  });

  it("keeps the mobile dashboard in one column", () => {
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(styles).toMatch(/\.stations-main\s*{\s*grid-template-rows:\s*auto/);
  });

  it("gives secondary pages full mobile width", () => {
    expect(styles).toContain(".content-page,");
    expect(styles).toContain("padding: $spacing-md !important");
  });

  it("defines a real backdrop outside the mobile-only block", () => {
    expect(styles.indexOf(".sidebar-backdrop")).toBeLessThan(
      styles.indexOf("// Mobile sidebar overlay"),
    );
    expect(appScript).toMatch(/backdrop\?\.addEventListener\(\s*"click"/);
  });
});

describe("real-browser coverage", () => {
  it("covers accepted and private real-app flows", () => {
    expect(verifier).toContain("verifyAcceptedAndPersistence");
    expect(verifier).toContain("verifyPrivate");
  });

  it("covers the unknown consent flow", () => {
    expect(verifier).toContain("verifyUnknown");
    expect(verifier).toContain("unknown-consent-mobile.png");
  });

  it("asserts horizontal overflow and decoded branding images", () => {
    expect(verifier).toContain("document.documentElement.scrollWidth - window.innerWidth");
    expect(verifier).toContain("await image.decode()");
  });
});
