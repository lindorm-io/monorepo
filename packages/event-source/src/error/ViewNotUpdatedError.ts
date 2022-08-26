import { DomainError } from "./DomainError";

export class ViewNotUpdatedError extends DomainError {
  public constructor(description: string) {
    super("View was not updated", { description, permanent: true });
  }
}
