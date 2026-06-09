import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class CommandSchemaValidationError extends DomainError {
  public constructor(error: Error, options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super("Schema validation error", {
      code: "command_schema_validation_failed",
      title: "Command Schema Validation Failed",
      details: "The command payload failed schema validation.",
      error,
      ...options,
      permanent: true,
    });
  }
}
