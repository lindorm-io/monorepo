import { DomainError } from "./DomainError.js";

export class ViewAlreadyCreatedError extends DomainError {
  public constructor(permanent = false) {
    super("View has already been created", { permanent });
  }
}
