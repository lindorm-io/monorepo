import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class SagaAlreadyCreatedError extends DomainError {
  public constructor(options: DomainErrorOptions = {}) {
    super("Saga has already been created", {
      code: "saga_already_created",
      title: "Saga Already Created",
      details: "The saga already exists and cannot be created again.",
      ...options,
    });
  }
}
