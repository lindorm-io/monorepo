import { ConcurrencyError } from "./ConcurrencyError";

export class ViewNotUpdatedError extends ConcurrencyError {
  public constructor(description: string) {
    super("Cache was not updated", { description });
  }
}
