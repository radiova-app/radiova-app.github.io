/**
 * Verifies that the project's ESLint-based TSDoc enforcement rules
 * reject undocumented public APIs while allowing private helpers to
 * remain undocumented.
 *
 * Creates temporary fixture files under src/__fixtures__/ (gitignored)
 * and runs eslint on them through the project config. The TypeScript
 * project service requires fixture files to be placed inside src/ to
 * be discovered by the parser.
 *
 * Related config: eslint.config.js
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

/** Temporary fixture files are placed under src/__fixtures__/ (gitignored). */
const fixturesDir = join(__dirname, "..", "src", "__fixtures__");

/**
 * Write a fixture file on disk so the TypeScript project service can
 * parse it. Returns the absolute path for cleanup.
 */
function createFixture(fileName: string, content: string): string {
  if (!existsSync(fixturesDir)) {
    mkdirSync(fixturesDir, { recursive: true });
  }
  const filePath = join(fixturesDir, fileName);
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

/**
 * Run eslint on a single file using the project config.
 * npx eslint exits with code 1 on any error, 0 on pass.
 */
function runEslint(filePath: string): { code: number; stdout: string; stderr: string } {
  let stdout = "";
  let stderr = "";
  let code = 0;
  try {
    execSync(`npx eslint "${filePath}"`, {
      encoding: "utf8",
      cwd: process.cwd(),
    });
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    stdout = err.stdout ?? "";
    stderr = err.stderr ?? "";
    code = err.status ?? 1;
  }
  return { code, stdout, stderr };
}

describe("TSDoc lint enforcement", () => {
  /**
   * An exported function without a JSDoc comment must produce an error
   * from jsdoc/require-jsdoc with the `ExportNamedDeclaration > FunctionDeclaration`
   * context and `publicOnly: true`.
   */
  it("fails for undocumented exported function", { timeout: 15000 }, () => {
    const file = createFixture(
      "undocumented-export.ts",
      "export function undocumentedApi(): void {}\n",
    );
    const { code, stdout, stderr } = runEslint(file);
    unlinkSync(file);
    expect(code).toBe(1);
    expect(stdout + stderr).toContain("Missing JSDoc comment");
  });

  /**
   * Adding a JSDoc comment must silence the require-jsdoc error.
   */
  it("passes for documented exported function", { timeout: 15000 }, () => {
    const file = createFixture(
      "documented-export.ts",
      "/** Documented public API. */\nexport function documentedApi(): void {}\n",
    );
    const { code, stdout, stderr } = runEslint(file);
    unlinkSync(file);
    expect(code).toBe(0);
    expect(stdout + stderr).not.toContain("Missing JSDoc comment");
  });

  /**
   * A non-exported (private) function must not be flagged even without
   * a JSDoc comment, because `publicOnly: true` filters it out and
   * the context is limited to `ExportNamedDeclaration`.
   */
  it("allows undocumented private helper", { timeout: 15000 }, () => {
    const file = createFixture(
      "private-helper.ts",
      "/** Doc. */\nexport const OK = true;\nfunction helper(): void { void OK; }\nhelper();\n",
    );
    const { code, stdout, stderr } = runEslint(file);
    unlinkSync(file);
    expect(code).toBe(0);
    expect(stdout + stderr).not.toContain("Missing JSDoc comment");
  });
});
