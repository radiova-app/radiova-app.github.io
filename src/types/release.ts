/** A downloadable release asset for a specific platform. */
export interface ReleaseDownload {
  platform: string;
  url: string;
  size: number;
  checksum: string;
  checksumType: string;
}

/** A software release with version metadata and platform downloads. */
export interface Release {
  version: string;
  publishedAt: string;
  releaseNotes: string;
  downloads: ReleaseDownload[];
}
