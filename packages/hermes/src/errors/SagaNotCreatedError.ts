import { DomainError } from "./DomainError";

export class SagaNotCreatedError extends DomainError {
  public constructor(permanent = false) {
    super("Saga has not been created", { permanent });
  }
}
