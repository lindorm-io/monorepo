import { DomainError } from "./DomainError.js";

export class ViewNotCreatedError extends DomainError {
  public constructor(permanent = false) {
    super("View has not been created", { permanent });
  }
}
