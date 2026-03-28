import type { IDeadLetterStore } from "../../interfaces/IrisDeadLetterStore";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../../types/dead-letter";

export class MemoryDeadLetterStore implements IDeadLetterStore {
  private readonly entries = new Map<string, DeadLetterEntry>();

  public async add(entry: DeadLetterEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  public async list(options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>> {
    let result = Array.from(this.entries.values());

    if (options?.topic) {
      result = result.filter((e) => e.topic === options.topic);
    }

    result.sort((a, b) => a.timestamp - b.timestamp);

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? result.length;

    return result.slice(offset, offset + limit);
  }

  public async get(id: string): Promise<DeadLetterEntry | null> {
    return this.entries.get(id) ?? null;
  }

  public async remove(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  public async purge(options?: DeadLetterFilterOptions): Promise<number> {
    if (!options?.topic) {
      const count = this.entries.size;
      this.entries.clear();
      return count;
    }

    let count = 0;

    for (const [id, entry] of this.entries) {
      if (entry.topic === options.topic) {
        this.entries.delete(id);
        count++;
      }
    }

    return count;
  }

  public async count(options?: DeadLetterFilterOptions): Promise<number> {
    if (!options?.topic) {
      return this.entries.size;
    }

    let count = 0;

    for (const entry of this.entries.values()) {
      if (entry.topic === options.topic) {
        count++;
      }
    }

    return count;
  }

  public async close(): Promise<void> {
    this.entries.clear();
  }
}
