import { DomainError } from "./DomainError";

export class SagaAlreadyCreatedError extends DomainError {
  public constructor(permanent = false) {
    super("Saga has already been created", { permanent });
  }
}
