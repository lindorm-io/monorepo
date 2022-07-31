import { ConcurrencyError } from "./ConcurrencyError";

export class MongoNotUpdatedError extends ConcurrencyError {
  public constructor() {
    super("Field was not updated");
  }
}
