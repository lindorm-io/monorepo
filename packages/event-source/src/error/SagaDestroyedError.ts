import { DomainError } from "./DomainError";

export class SagaDestroyedError extends DomainError {
  public constructor() {
    super("Saga is destroyed", { permanent: true });
  }
}
