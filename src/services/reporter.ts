import { hasConsent } from './consent';

/** A single stream playback failure report. */
export interface StreamReport {
  stationId: string | null;
  stationName: string | null;
  endpointId: string | null;
  endpointUrl: string | null;
  errorCode: string;
  errorMessage: string;
  createdAt: string;
}

const STORAGE_KEY = 'radiova-stream-report-queue';
const MAX_QUEUE_SIZE = 50;

/** LocalStorage-backed report queue (max 50 entries). */
export class LocalQueueTransport {
  /** Append a report to the queue in localStorage. */
  enqueue(report: StreamReport): void {
    if (!hasConsent('diagnostics')) return;
    try {
      const queue = this.list();
      queue.push(report);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
    } catch {
      // local reporting is best-effort
    }
  }

  /** Read all queued reports. */
  list(): StreamReport[] {
    if (!hasConsent('diagnostics')) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as StreamReport[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Clear all queued reports from localStorage. */
  clear(): void {
    if (!hasConsent('diagnostics')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/** No-op remote transport (placeholder for future server-side reporting). */
export class DisabledRemoteTransport {
  /** Always returns false — no remote endpoint configured. */
  send(_report: StreamReport): Promise<boolean> {
    return Promise.resolve(false);
  }
}

const localQueue = new LocalQueueTransport();
const remote = new DisabledRemoteTransport();

/**
 * Queue a stream failure report locally and attempt remote delivery.
 * Respects the diagnostics consent category.
 */
export function queueStreamReport(report: StreamReport): void {
  if (!hasConsent('diagnostics')) return;
  localQueue.enqueue(report);
  void remote.send(report);
}
