import type { DelayedEntry } from "../types";

export interface IDelayStore {
  schedule(entry: DelayedEntry): Promise<void>;
  poll(now: number): Promise<Array<DelayedEntry>>;
  cancel(id: string): Promise<boolean>;
  size(): Promise<number>;
  clear(): Promise<void>;
  close(): Promise<void>;
}
