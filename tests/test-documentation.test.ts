/**
 * Automated checks for test documentation conventions.
 *
 * Verifies that:
 *   - Each test file in tests/ has a file-level JSDoc comment
 *   - Each verification script in scripts/ has a file-level JSDoc comment
 *   - Every `.skip` call has a nearby explanatory comment
 *
 * This is a lightweight scanner, not a full parser. It reads source
 * lines directly and looks for patterns, which is sufficient for these
 * narrow checks. False positives are possible if comments are formatted
 * unusually — adjust the regex patterns when that happens.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..");

/** All regular test files under tests/. */
const testFiles = readdirSync(join(root, "tests"))
  .filter((f) => f.endsWith(".ts") && f !== "test-documentation.test.ts")
  .map((f) => ({
    name: f,
    path: join(root, "tests", f),
    content: readFileSync(join(root, "tests", f), "utf8"),
  }));

/** All verification scripts under scripts/. */
const verifyFiles = readdirSync(join(root, "scripts"))
  .filter((f) => f.startsWith("verify-") && f.endsWith(".mjs"))
  .map((f) => ({
    name: f,
    path: join(root, "scripts", f),
    content: readFileSync(join(root, "scripts", f), "utf8"),
  }));

/**
 * Check whether the first non-shebang, non-blank line (or first few lines)
 * of a file is a JSDoc comment (slash-star-star ... star-slash).
 */
function hasFileLevelDoc(content: string): boolean {
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = (lines[i] as string).trim();
    if (line === "" || line.startsWith("#!/")) {
      i++;
      continue;
    }
    return line.startsWith("/**");
  }
  return false;
}

/**
 * Find all `.skip` or `.skipIf` calls and check if a comment exists
 * on the line immediately above.
 */
function findUnexplainedSkips(content: string, fileName: string): string[] {
  const lines = content.split("\n");
  const issues: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (
      /\.skip\s*[($]/.test(line) ||
      /it\.skip\b/.test(line) ||
      /describe\.skip\b/.test(line) ||
      /\.skipIf\b/.test(line)
    ) {
      const prevLine = i > 0 ? (lines[i - 1] as string).trim() : "";
      const hasComment =
        prevLine.startsWith("//") ||
        prevLine.startsWith("/*") ||
        prevLine.endsWith("*/") ||
        prevLine.includes("skip") ||
        line.trim().startsWith("//");
      if (!hasComment) {
        issues.push(`${fileName}:${String(i + 1)}: ${line.trim()}`);
      }
    }
  }
  return issues;
}

describe("test file documentation conventions", () => {
  it("every test file has a file-level JSDoc comment", () => {
    const missing = testFiles
      .filter((f) => !hasFileLevelDoc(f.content))
      .map((f) => f.name);
    expect(missing, `Files missing file-level JSDoc: ${missing.join(", ")}`).toEqual([]);
  });

  it("every verify-*.mjs script has a file-level JSDoc comment", () => {
    const missing = verifyFiles
      .filter((f) => !hasFileLevelDoc(f.content))
      .map((f) => f.name);
    expect(missing, `Scripts missing file-level JSDoc: ${missing.join(", ")}`).toEqual([]);
  });

  it("every .skip call has a preceding comment", () => {
    const allIssues: string[] = [];
    for (const f of testFiles) {
      const issues = findUnexplainedSkips(f.content, f.name);
      allIssues.push(...issues);
    }
    expect(
      allIssues,
      `Unexplained .skip calls:\n${allIssues.join("\n")}`,
    ).toEqual([]);
  });
});
