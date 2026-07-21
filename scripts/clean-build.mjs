import { rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const outDir = process.argv[2] ? resolve(root, process.argv[2]) : resolve(root, "dist");

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
  console.log(`Removed ${outDir}`);
}
