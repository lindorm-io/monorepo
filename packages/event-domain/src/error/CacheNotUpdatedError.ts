import { ConcurrencyError } from "./ConcurrencyError";

export class CacheNotUpdatedError extends ConcurrencyError {
  public constructor(description: string) {
    super("Cache was not updated", { description });
  }
}
