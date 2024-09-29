import { DomainError } from "./DomainError";

export class ViewNotUpdatedError extends DomainError {
  public constructor(message?: string) {
    super(message ? message : "View was not updated", { permanent: true });
  }
}
