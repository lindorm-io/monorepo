import { ConcurrencyError } from "./ConcurrencyError";

export class MongoDuplicateKeyError extends ConcurrencyError {
  public constructor(message: string, error: Error) {
    super(message, {
      debug: error,
    });
  }
}
