import { DomainError } from "./DomainError";

export class CommandSchemaValidationError extends DomainError {
  public constructor(joiError: Error) {
    super("Schema validation error", {
      debug: {
        joiError,
      },
      permanent: true,
    });
  }
}
