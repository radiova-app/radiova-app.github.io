import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const canonicalSource = path.resolve(
  repositoryRoot,
  "..",
  "radiova-platform-private",
  "packages",
  "branding",
  "originals",
  "active.png",
);
const brandingDirectory = path.join(repositoryRoot, "public", "assets", "branding");
const iconDirectory = path.join(repositoryRoot, "public", "icons");

const generatedAssets = [
  { file: "assets/branding/radiova-logo-48.png", width: 48, height: 48, padding: 0 },
  { file: "assets/branding/radiova-logo-128.png", width: 128, height: 128, padding: 0 },
  { file: "icons/favicon-16.png", width: 16, height: 16, padding: 0 },
  { file: "icons/favicon-32.png", width: 32, height: 32, padding: 0 },
  { file: "icons/apple-touch-icon.png", width: 180, height: 180, padding: 0.1 },
  { file: "icons/icon-192.png", width: 192, height: 192, padding: 0.08 },
  { file: "icons/icon-512.png", width: 512, height: 512, padding: 0.08 },
  { file: "icons/icon-192-maskable.png", width: 192, height: 192, padding: 0.2 },
  { file: "icons/icon-512-maskable.png", width: 512, height: 512, padding: 0.2 },
];

async function renderAsset(sourceBuffer, asset) {
  const horizontalPadding = Math.round(asset.width * asset.padding);
  const verticalPadding = Math.round(asset.height * asset.padding);
  const innerWidth = asset.width - horizontalPadding * 2;
  const innerHeight = asset.height - verticalPadding * 2;
  const outputPath = path.join(repositoryRoot, "public", asset.file);

  await sharp(sourceBuffer)
    .resize(innerWidth, innerHeight, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .extend({
      top: verticalPadding,
      bottom: verticalPadding,
      left: horizontalPadding,
      right: horizontalPadding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toFile(outputPath);
}

async function main() {
  let sourceBuffer;
  try {
    sourceBuffer = await readFile(canonicalSource);
  } catch (error) {
    throw new Error(`Canonical Radiova logo is missing: ${canonicalSource}`, { cause: error });
  }

  const metadata = await sharp(sourceBuffer).metadata();
  if (
    metadata.format !== "png" ||
    metadata.width !== 128 ||
    metadata.height !== 128 ||
    !metadata.hasAlpha
  ) {
    throw new Error("Canonical Radiova logo must be the inspected 128x128 transparent PNG.");
  }

  await mkdir(brandingDirectory, { recursive: true });
  await mkdir(iconDirectory, { recursive: true });

  const canonicalLogoPath = path.join(brandingDirectory, "radiova-logo.png");
  await copyFile(canonicalSource, canonicalLogoPath);

  for (const asset of generatedAssets) {
    await renderAsset(sourceBuffer, asset);
  }

  for (const legacyFile of [
    "assets/icons/icon-192.png",
    "assets/icons/icon-512.png",
    "assets/icons/icon-192-maskable.png",
    "assets/icons/icon-512-maskable.png",
    "favicon.svg",
  ]) {
    await rm(path.join(repositoryRoot, "public", legacyFile), { force: true });
  }

  const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
  const manifest = {
    canonicalSource: "../radiova-platform-private/packages/branding/originals/active.png",
    canonicalSourceFilename: "active.png",
    sourceSha256: sourceHash,
    sourceDimensions: { width: metadata.width, height: metadata.height },
    sourceFormat: metadata.format,
    sourceHasAlpha: metadata.hasAlpha,
    generated: [
      { file: "assets/branding/radiova-logo.png", width: 128, height: 128 },
      ...generatedAssets.map(({ file, width, height }) => ({ file, width, height })),
    ],
  };

  await writeFile(
    path.join(brandingDirectory, "branding-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

await main();
