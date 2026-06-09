import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class SagaNotCreatedError extends DomainError {
  public constructor(options: DomainErrorOptions = {}) {
    super("Saga has not been created", {
      code: "saga_not_created",
      title: "Saga Not Created",
      details:
        "The saga has not been created yet and must be created before it can handle this message.",
      ...options,
    });
  }
}
