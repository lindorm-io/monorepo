import type { IDelayStore } from "../../interfaces/IrisDelayStore.js";
import type { DelayedEntry } from "../../types/delay.js";

export class MemoryDelayStore implements IDelayStore {
  private readonly entries = new Map<string, DelayedEntry>();

  public async schedule(entry: DelayedEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  public async poll(now: number): Promise<Array<DelayedEntry>> {
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

  public async cancel(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  public async size(): Promise<number> {
    return this.entries.size;
  }

  public async clear(): Promise<void> {
    this.entries.clear();
  }

  public async close(): Promise<void> {
    this.entries.clear();
  }
}
