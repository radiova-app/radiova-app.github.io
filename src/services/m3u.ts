import type { Station, StationEndpoint } from '../types/station';

function parseExtInf(line: string): { name: string; tvgId?: string; endpointId?: string; logo?: string; codec?: string; bitrate?: number; groupTitle?: string } {
  const meta: ReturnType<typeof parseExtInf> = { name: '' };
  const parts = line.match(/#EXTINF:-1\s+(.*?),\s*(.*)/);
  if (!parts) return meta;

  const attrs = parts[1] ?? '';
  meta.name = (parts[2] ?? '').trim();

  const idMatch = attrs.match(/tvg-id="([^"]*)"/);
  if (idMatch) meta.tvgId = idMatch[1];

  const epMatch = attrs.match(/radio-endpoint-id="([^"]*)"/);
  if (epMatch) meta.endpointId = epMatch[1];

  const logoMatch = attrs.match(/tvg-logo="([^"]*)"/);
  if (logoMatch) meta.logo = logoMatch[1];

  const codecMatch = attrs.match(/radio-codec="([^"]*)"/);
  if (codecMatch) meta.codec = codecMatch[1];

  const bitrateMatch = attrs.match(/radio-bitrate="?(\d+)"?/);
  if (bitrateMatch?.[1]) meta.bitrate = parseInt(bitrateMatch[1], 10);

  const groupMatch = attrs.match(/group-title="([^"]*)"/);
  if (groupMatch) meta.groupTitle = groupMatch[1];

  return meta;
}

/**
 * Parse M3U content into an array of Station objects.
 * Merges duplicate stations by ID and collects multiple endpoints.
 * @param content - The M3U file content.
 * @returns Array of parsed Station objects.
 */
export function parseM3U(content: string): Station[] {
  const lines = content.split(/\r?\n/);
  const stationMap = new Map<string, Station>();

  let currentExtInf: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      if (line.startsWith('#EXTINF:')) {
        currentExtInf = line;
      }
      continue;
    }

    const url = line;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mms://')) {
      continue;
    }

    if (!currentExtInf) {
      continue;
    }

    const meta = parseExtInf(currentExtInf);
    currentExtInf = null;

    const stationId = meta.tvgId || url;
    const endpointId = meta.endpointId || `ep-${simpleHash(url)}`;

    const endpoint: StationEndpoint = {
      id: endpointId,
      url,
      codec: meta.codec,
      bitrate: meta.bitrate,
    };

    if (stationMap.has(stationId)) {
      const existing = stationMap.get(stationId);
      if (existing) {
        const hasUrl = existing.endpoints.some((e) => e.url === url);
        if (!hasUrl) {
          existing.endpoints.push(endpoint);
        }
        if (!existing.logo && meta.logo) {
          existing.logo = meta.logo;
        }
      }
    } else {
      stationMap.set(stationId, {
        id: stationId,
        name: meta.name || stationId,
        logo: meta.logo,
        genre: meta.groupTitle,
        locale: meta.groupTitle && ['uk', 'en', 'de', 'global'].includes(meta.groupTitle.toLowerCase()) ? meta.groupTitle.toLowerCase() : undefined,
        endpoints: [endpoint],
      });
    }
  }

  return Array.from(stationMap.values());
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 16);
}

/**
 * Build M3U file content from an array of Station objects.
 * Each endpoint becomes a separate EXTINF entry.
 * @param stations - The stations to export.
 * @returns The M3U file content.
 */
export function buildM3U(stations: Station[]): string {
  let out = '#EXTM3U\n';
  for (const st of stations) {
    for (const ep of st.endpoints) {
      const attrs: string[] = [`tvg-id="${st.id}"`];
      if (ep.id) attrs.push(`radio-endpoint-id="${ep.id}"`);
      if (ep.codec) attrs.push(`radio-codec="${ep.codec}"`);
      if (ep.bitrate) attrs.push(`radio-bitrate="${String(ep.bitrate)}"`);
      if (st.logo) attrs.push(`tvg-logo="${st.logo}"`);
      if (st.locale) attrs.push(`group-title="${st.locale}"`);
      out += `#EXTINF:-1 ${attrs.join(' ')},${st.name}\n${ep.url}\n`;
    }
  }
  return out;
}

/**
 * Validate M3U content structure.
 * Checks for #EXTM3U header and matching EXTINF/URL pairs.
 * @param content - The M3U file content.
 * @returns true if the content is valid M3U.
 */
export function validateM3U(content: string): boolean {
  if (!content.startsWith('#EXTM3U')) return false;
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  let extinfCount = 0;
  let urlCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#EXTINF:')) extinfCount++;
    else if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mms://')) urlCount++;
  }
  return extinfCount > 0 && extinfCount === urlCount;
}
