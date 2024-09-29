import { DomainError } from "./DomainError";

export class AggregateNotDestroyedError extends DomainError {
  public constructor() {
    super("Aggregate has not been destroyed", { permanent: true });
  }
}
