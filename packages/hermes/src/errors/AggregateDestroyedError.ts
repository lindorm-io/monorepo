import { DomainError } from "./DomainError.js";

export class AggregateDestroyedError extends DomainError {
  public constructor() {
    super("Aggregate is destroyed", { permanent: true });
  }
}
