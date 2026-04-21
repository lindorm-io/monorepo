import { DomainError } from "./DomainError.js";

export class CommandSchemaValidationError extends DomainError {
  public constructor(error: Error) {
    super("Schema validation error", { error, permanent: true });
  }
}
