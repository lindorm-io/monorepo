import { DomainError } from "./DomainError";

export class AggregateDestroyedError extends DomainError {
  public constructor() {
    super("Aggregate is destroyed", { permanent: true });
  }
}
