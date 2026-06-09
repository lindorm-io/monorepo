import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class ViewAlreadyCreatedError extends DomainError {
  public constructor(options: DomainErrorOptions = {}) {
    super("View has already been created", {
      code: "view_already_created",
      title: "View Already Created",
      details: "The view already exists and cannot be created again.",
      ...options,
    });
  }
}
