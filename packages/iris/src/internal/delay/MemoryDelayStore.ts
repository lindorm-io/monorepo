import type { IDelayStore } from "../../interfaces/IrisDelayStore.js";
import type { DelayedEntry } from "../../types/delay.js";

export class MemoryDelayStore implements IDelayStore {
  private readonly entries = new Map<string, DelayedEntry>();

  async schedule(entry: DelayedEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async poll(now: number): Promise<Array<DelayedEntry>> {
    const ready: Array<DelayedEntry> = [];

    for (const [id, entry] of this.entries) {
      if (entry.deliverAt <= now) {
        ready.push(entry);
        this.entries.delete(id);
      }
    }

    ready.sort((a, b) => a.deliverAt - b.deliverAt);

    return ready;
  }

  async cancel(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async size(): Promise<number> {
    return this.entries.size;
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  async close(): Promise<void> {
    this.entries.clear();
  }
}
