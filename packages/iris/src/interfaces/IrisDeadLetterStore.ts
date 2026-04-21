import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../types/index.js";

export interface IDeadLetterStore {
  add(entry: DeadLetterEntry): Promise<void>;
  list(options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>>;
  get(id: string): Promise<DeadLetterEntry | null>;
  remove(id: string): Promise<boolean>;
  purge(options?: DeadLetterFilterOptions): Promise<number>;
  count(options?: DeadLetterFilterOptions): Promise<number>;
  close(): Promise<void>;
}
