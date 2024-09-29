import { DomainError } from "./DomainError";

export class CommandSchemaValidationError extends DomainError {
  public constructor(error: Error) {
    super("Schema validation error", { error, permanent: true });
  }
}
