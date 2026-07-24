import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..", "..");

const requiredFiles = [
  "README.md",
  "README_UK.md",
  "README_DE.md",
  "CONTRIBUTING.md",
  "CONTRIBUTING_UK.md",
  "CONTRIBUTING_DE.md",
  "CODE_OF_CONDUCT.md",
  "CODE_OF_CONDUCT_UK.md",
  "CODE_OF_CONDUCT_DE.md",
  "SECURITY.md",
  "SECURITY_UK.md",
  "SECURITY_DE.md",
  "SUPPORT.md",
  "SUPPORT_UK.md",
  "SUPPORT_DE.md",
  "CHANGELOG.md",
  "REPOSITORY.md",
  "REPOSITORY_UK.md",
  "REPOSITORY_DE.md",
  "DOCUMENTATION.md",
  "DOCUMENTATION_UK.md",
  "DOCUMENTATION_DE.md",
  "LICENSE",
  ".gitignore",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/REPOSITORY-SETTINGS.md",
  ".github/scripts/verify-public-docs.mjs",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/broken_station.yml",
  ".github/ISSUE_TEMPLATE/translation.yml",
  ".github/ISSUE_TEMPLATE/accessibility.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
];

const translationGroups = [
  ["README.md", "README_UK.md", "README_DE.md"],
  ["CONTRIBUTING.md", "CONTRIBUTING_UK.md", "CONTRIBUTING_DE.md"],
  ["CODE_OF_CONDUCT.md", "CODE_OF_CONDUCT_UK.md", "CODE_OF_CONDUCT_DE.md"],
  ["SECURITY.md", "SECURITY_UK.md", "SECURITY_DE.md"],
  ["SUPPORT.md", "SUPPORT_UK.md", "SUPPORT_DE.md"],
  ["REPOSITORY.md", "REPOSITORY_UK.md", "REPOSITORY_DE.md"],
  ["DOCUMENTATION.md", "DOCUMENTATION_UK.md", "DOCUMENTATION_DE.md"],
];

const navigationFiles = translationGroups.flat();

const manualDocsWarnings = new Map([
  [".md", "Do not edit files inside docs/ manually."],
  ["_UK.md", "Не редагуйте файли всередині docs/ вручну."],
  ["_DE.md", "Dateien in docs/ nicht manuell bearbeiten."],
]);
const allowedPlaceholders = new Set([]);
const forbiddenRootEntries = ["src", "tests", "scripts", "public", "documentation", "package.json", "package-lock.json", "pnpm-lock.yaml", "astro.config.mjs", "eslint.config.js", "tsconfig.json", "vitest.config.ts"];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return existsSync(path.join(root, relativePath));
}

function assertFile(relativePath) {
  if (!exists(relativePath)) {
    fail(`missing required file: ${relativePath}`);
  }
}

function markdownHeadings(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,6})\s+/))
    .filter(Boolean)
    .map((match) => match[1].length);
}

function normalizeLink(link) {
  const [target] = link.split(/[?#]/, 1);
  return target;
}

function collectMarkdownLinks(text) {
  const links = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(text))) {
    links.push(match[1].trim());
  }
  return links;
}

function linkExists(fromFile, link) {
  const target = normalizeLink(link);
  if (!target || target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:") || target.startsWith("#")) {
    return true;
  }

  const fromDir = path.dirname(path.join(root, fromFile));
  const candidates = [];

  if (target.endsWith("/")) {
    candidates.push(path.resolve(fromDir, target, "index.md"));
    candidates.push(path.resolve(fromDir, target, "index.html"));
  } else {
    candidates.push(path.resolve(fromDir, target));
    candidates.push(path.resolve(fromDir, `${target}.md`));
    candidates.push(path.resolve(fromDir, `${target}.yml`));
    candidates.push(path.resolve(fromDir, `${target}.yaml`));
    candidates.push(path.resolve(fromDir, target, "index.md"));
  }

  return candidates.some((candidate) => existsSync(candidate));
}

function checkRelativeLinks(file) {
  const text = read(file);
  for (const link of collectMarkdownLinks(text)) {
    if (!linkExists(file, link)) {
      fail(`broken relative link in ${file}: ${link}`);
    }
  }
}

function checkNoPrivatePaths(file) {
  const text = read(file);
  if (/\b[A-Za-z]:\\/.test(text)) {
    fail(`private Windows absolute path found in ${file}`);
  }
}

function checkManualDocsWarning(file) {
  const text = read(file);
  const expected = manualDocsWarnings.get(file.endsWith("_UK.md") ? "_UK.md" : file.endsWith("_DE.md") ? "_DE.md" : ".md");
  if (expected && !text.includes(expected)) {
    fail(`missing manual docs warning in ${file}`);
  }
}

function checkPlaceholderPolicy(file) {
  const text = read(file);
  const matches = text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
  for (const token of matches) {
    if (allowedPlaceholders.has(token)) {
      continue;
    }
    if (token.includes("TODO") || token.includes("FIXME")) {
      fail(`unexpected placeholder in ${file}: ${token}`);
    }
  }

  if (/SECURITY_CONTACT_TODO/.test(text)) fail(`security placeholder remains in ${file}`);
  if (/TODO security contact/i.test(text)) fail(`security contact placeholder remains in ${file}`);
  if (/placeholder security email/i.test(text)) fail(`security email placeholder remains in ${file}`);
  if (/public GitHub Issues?[^\n]*vulnerab/i.test(text) || /public Issues?[^\n]*vulnerab/i.test(text)) {
    fail(`public issues are recommended for vulnerabilities in ${file}`);
  }
}

function compareSectionStructures(group) {
  const levels = group.map((file) => markdownHeadings(read(file)));
  const first = JSON.stringify(levels[0]);
  for (let index = 1; index < levels.length; index += 1) {
    if (JSON.stringify(levels[index]) !== first) {
      fail(`section structure mismatch in ${group.join(", ")}`);
      break;
    }
  }
}

function checkIssueTemplate(file) {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  if (/\t/.test(text)) {
    fail(`tab character found in ${file}`);
  }

  if (file.endsWith("config.yml")) {
    if (!lines.some((line) => /^blank_issues_enabled:\s+false$/.test(line))) fail(`blank issues should be disabled in ${file}`);
    if (!lines.some((line) => /^contact_links:/.test(line))) fail(`missing contact_links in ${file}`);
    if (!lines.some((line) => /^\s+- name:\s+/.test(line))) fail(`missing contact link entries in ${file}`);
    return;
  }

  if (!lines.some((line) => /^name:\s+/.test(line))) fail(`missing name in ${file}`);
  if (!lines.some((line) => /^description:\s+/.test(line))) fail(`missing description in ${file}`);

  if (!lines.some((line) => /^body:/.test(line))) fail(`missing body in ${file}`);
  if (!lines.some((line) => /^\s+- type:\s+/.test(line))) fail(`missing form fields in ${file}`);
  if (!lines.some((line) => /^\s+attributes:/.test(line))) fail(`missing attributes in ${file}`);
}

function checkTrackedDocs() {
  const result = spawnSync("git", ["ls-files", "docs"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    fail("docs/ is not tracked by git");
  }
}

function checkDeploymentOnly() {
  for (const entry of forbiddenRootEntries) {
    if (exists(entry)) {
      fail(`forbidden source or build file exists: ${entry}`);
    }
  }

  if (!exists("docs") || !statSync(path.join(root, "docs")).isDirectory()) {
    fail("docs/ directory is missing");
  }

  if (!exists(".github/ISSUE_TEMPLATE")) {
    fail("issue template directory is missing");
  }
}

function checkLocalizedNaming() {
  const result = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    fail("unable to inspect tracked files");
    return;
  }

  for (const line of result.stdout.split(/\r?\n/)) {
    if (/\.(uk|de)\.md$/i.test(line)) {
      fail(`legacy localized filename still tracked: ${line}`);
    }
  }
}

function navExpectation(file) {
  if (file === "README.md") return "English | [Українська](README_UK.md) | [Deutsch](README_DE.md)";
  if (file === "README_UK.md") return "[English](README.md) | Українська | [Deutsch](README_DE.md)";
  if (file === "README_DE.md") return "[English](README.md) | [Українська](README_UK.md) | Deutsch";
  if (file.endsWith(".md") && !file.includes("_")) {
    const base = file.replace(/\.md$/, "");
    return `English | [Українська](${base}_UK.md) | [Deutsch](${base}_DE.md)`;
  }

  const base = file.replace(/_(UK|DE)\.md$/, "");
  if (file.endsWith("_UK.md")) return `[English](${base}.md) | Українська | [Deutsch](${base}_DE.md)`;
  if (file.endsWith("_DE.md")) return `[English](${base}.md) | [Українська](${base}_UK.md) | Deutsch`;
  return null;
}

function checkLanguageNavigation(file) {
  const expected = navExpectation(file);
  if (!expected) return;
  const firstLine = read(file).split(/\r?\n/)[2] ?? "";
  if (firstLine !== expected) {
    fail(`language navigation mismatch in ${file}`);
  }
  const linkCount = (firstLine.match(/\[/g) ?? []).length;
  if (linkCount !== 2) fail(`language navigation must contain exactly two links in ${file}`);
}

function checkSecurityPolicy() {
  const localizedMarkers = [
    ["SECURITY.md", "Private Vulnerability Reporting"],
    ["SECURITY_UK.md", "Private Vulnerability Reporting"],
    ["SECURITY_DE.md", "Private Vulnerability Reporting"],
  ];

  for (const [file, marker] of localizedMarkers) {
    const text = read(file);
    if (!text.includes(marker) && !/GitHub Private Vulnerability Reporting/i.test(text)) {
      fail(`missing private vulnerability reporting language in ${file}`);
    }
    if (text.includes("SECURITY_CONTACT_TODO")) {
      fail(`security placeholder remains in ${file}`);
    }
    if (/public GitHub Issues?[^\n]*vulnerab/i.test(text) || /public Issues?[^\n]*vulnerab/i.test(text)) {
      fail(`public issues are recommended for vulnerabilities in ${file}`);
    }
    if (/[^\w]?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)) {
      fail(`email address found in ${file}`);
    }
  }
}

function main() {
  for (const file of requiredFiles) {
    assertFile(file);
  }

  checkDeploymentOnly();
  checkLocalizedNaming();
  checkSecurityPolicy();
  checkTrackedDocs();

  for (const group of translationGroups) {
    compareSectionStructures(group);
  }

  for (const file of requiredFiles.filter((file) => file.endsWith(".md") || file.endsWith(".yml") || file.endsWith(".yaml"))) {
    checkRelativeLinks(file);
    checkNoPrivatePaths(file);
    checkPlaceholderPolicy(file);
  }

  for (const file of navigationFiles) {
    checkLanguageNavigation(file);
  }

  for (const file of [
    "README.md",
    "README_UK.md",
    "README_DE.md",
    "CONTRIBUTING.md",
    "CONTRIBUTING_UK.md",
    "CONTRIBUTING_DE.md",
    "CODE_OF_CONDUCT.md",
    "CODE_OF_CONDUCT_UK.md",
    "CODE_OF_CONDUCT_DE.md",
    "SECURITY.md",
    "SECURITY_UK.md",
    "SECURITY_DE.md",
    "SUPPORT.md",
    "SUPPORT_UK.md",
    "SUPPORT_DE.md",
    "REPOSITORY.md",
    "REPOSITORY_UK.md",
    "REPOSITORY_DE.md",
    "DOCUMENTATION.md",
    "DOCUMENTATION_UK.md",
    "DOCUMENTATION_DE.md",
  ]) {
    checkManualDocsWarning(file);
  }

  for (const file of [
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/broken_station.yml",
    ".github/ISSUE_TEMPLATE/translation.yml",
    ".github/ISSUE_TEMPLATE/accessibility.yml",
    ".github/ISSUE_TEMPLATE/config.yml",
  ]) {
    checkIssueTemplate(file);
  }

  console.log("Public documentation checks passed.");
}

main();
