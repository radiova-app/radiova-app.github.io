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

export class LocalQueueTransport {
  enqueue(report: StreamReport): void {
    try {
      const queue = this.list();
      queue.push(report);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
    } catch {
      // local reporting is best-effort
    }
  }

  list(): StreamReport[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as StreamReport[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export class DisabledRemoteTransport {
  send(_report: StreamReport): Promise<boolean> {
    return Promise.resolve(false);
  }
}

const localQueue = new LocalQueueTransport();
const remote = new DisabledRemoteTransport();

export function queueStreamReport(report: StreamReport): void {
  localQueue.enqueue(report);
  void remote.send(report);
}
