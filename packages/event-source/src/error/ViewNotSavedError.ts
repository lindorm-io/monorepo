import { ConcurrencyError } from "./ConcurrencyError";

export class ViewNotSavedError extends ConcurrencyError {
  public constructor(description: string) {
    super("Cache was not saved", { description });
  }
}
