import { DomainError } from "./DomainError";

export class AggregateAlreadyCreatedError extends DomainError {
  public constructor() {
    super("Aggregate has already been created", { permanent: true });
  }
}
