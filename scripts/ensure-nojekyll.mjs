import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const outDir = process.argv[2] ? resolve(root, process.argv[2]) : resolve(root, "dist");
const nojekyll = resolve(outDir, ".nojekyll");

if (!existsSync(nojekyll)) {
  writeFileSync(nojekyll, "", "utf-8");
  console.log(`Created ${nojekyll}`);
}
