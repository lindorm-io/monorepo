import { ConcurrencyError } from "./ConcurrencyError";

export class CacheNotSavedError extends ConcurrencyError {
  public constructor(description: string) {
    super("Cache was not saved", { description });
  }
}
