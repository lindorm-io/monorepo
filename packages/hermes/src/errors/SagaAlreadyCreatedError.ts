import { DomainError } from "./DomainError.js";

export class SagaAlreadyCreatedError extends DomainError {
  public constructor(permanent = false) {
    super("Saga has already been created", { permanent });
  }
}
