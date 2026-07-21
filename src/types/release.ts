export interface ReleaseDownload {
  platform: string;
  url: string;
  size: number;
  checksum: string;
  checksumType: string;
}

export interface Release {
  version: string;
  publishedAt: string;
  releaseNotes: string;
  downloads: ReleaseDownload[];
}
