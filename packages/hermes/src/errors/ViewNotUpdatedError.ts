import { DomainError } from "./DomainError.js";

export class ViewNotUpdatedError extends DomainError {
  public constructor(message?: string) {
    super(message ?? "View was not updated", { permanent: true });
  }
}
