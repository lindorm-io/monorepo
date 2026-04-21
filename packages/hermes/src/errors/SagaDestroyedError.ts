import { DomainError } from "./DomainError.js";

export class SagaDestroyedError extends DomainError {
  public constructor() {
    super("Saga is destroyed", { permanent: true });
  }
}
