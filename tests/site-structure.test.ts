import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");

function pathExists(relative: string): boolean {
  return existsSync(resolve(root, relative));
}

describe("site structure", () => {
  it("has required config files", () => {
    expect(pathExists("astro.config.mjs")).toBe(true);
    expect(pathExists("tsconfig.json")).toBe(true);
    expect(pathExists("eslint.config.js")).toBe(true);
    expect(pathExists(".prettierrc")).toBe(true);
    expect(pathExists(".prettierignore")).toBe(true);
    expect(pathExists(".editorconfig")).toBe(true);
    expect(pathExists(".gitignore")).toBe(true);
    expect(pathExists("vitest.config.ts")).toBe(true);
    expect(pathExists("package.json")).toBe(true);
  });

  it("has required source directories", () => {
    expect(pathExists("src/components")).toBe(true);
    expect(pathExists("src/layouts")).toBe(true);
    expect(pathExists("src/pages")).toBe(true);
    expect(pathExists("src/pages/uk")).toBe(true);
    expect(pathExists("src/styles")).toBe(true);
    expect(pathExists("src/types")).toBe(true);
    expect(pathExists("src/config")).toBe(true);
    expect(pathExists("src/services")).toBe(true);
  });

  it("has required public directories", () => {
    expect(pathExists("public")).toBe(true);
    expect(pathExists("public/assets/branding")).toBe(true);
    expect(pathExists("public/assets/icons")).toBe(true);
    expect(pathExists("public/assets/screenshots")).toBe(true);
  });

  it("has required components", () => {
    expect(pathExists("src/components/Header.astro")).toBe(true);
    expect(pathExists("src/components/Footer.astro")).toBe(true);
    expect(pathExists("src/components/LanguageSwitcher.astro")).toBe(true);
    expect(pathExists("src/components/PlatformCard.astro")).toBe(true);
    expect(pathExists("src/components/DownloadCard.astro")).toBe(true);
  });

  it("has required layouts", () => {
    expect(pathExists("src/layouts/BaseLayout.astro")).toBe(true);
  });

  it("has all English pages", () => {
    expect(pathExists("src/pages/index.astro")).toBe(true);
    expect(pathExists("src/pages/downloads.astro")).toBe(true);
    expect(pathExists("src/pages/support.astro")).toBe(true);
    expect(pathExists("src/pages/privacy.astro")).toBe(true);
  });

  it("has all Ukrainian pages", () => {
    expect(pathExists("src/pages/uk/index.astro")).toBe(true);
    expect(pathExists("src/pages/uk/downloads.astro")).toBe(true);
    expect(pathExists("src/pages/uk/support.astro")).toBe(true);
    expect(pathExists("src/pages/uk/privacy.astro")).toBe(true);
  });

  it("has all German pages", () => {
    expect(pathExists("src/pages/de/index.astro")).toBe(true);
    expect(pathExists("src/pages/de/downloads.astro")).toBe(true);
    expect(pathExists("src/pages/de/support.astro")).toBe(true);
    expect(pathExists("src/pages/de/privacy.astro")).toBe(true);
  });

  it("has required source files", () => {
    expect(pathExists("src/styles/_tokens.scss")).toBe(true);
    expect(pathExists("src/styles/global.scss")).toBe(true);
    expect(pathExists("src/types/release.ts")).toBe(true);
    expect(pathExists("src/config/site.ts")).toBe(true);
    expect(pathExists("src/services/releases.ts")).toBe(true);
    expect(pathExists("src/env.d.ts")).toBe(true);
  });

  it("has public assets", () => {
    expect(pathExists("public/favicon.svg")).toBe(true);
    expect(pathExists("public/robots.txt")).toBe(true);
  });

  it("has GitHub Actions workflow", () => {
    expect(pathExists(".github/workflows/deploy.yml")).toBe(true);
  });

  it("has helper scripts", () => {
    expect(pathExists("scripts/clean-build.mjs")).toBe(true);
    expect(pathExists("scripts/ensure-nojekyll.mjs")).toBe(true);
    expect(pathExists("scripts/serve-docs.mjs")).toBe(true);
  });

  it("has test file", () => {
    expect(pathExists("tests/site-structure.test.ts")).toBe(true);
  });
});
