import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class ViewNotCreatedError extends DomainError {
  constructor(options: DomainErrorOptions = {}) {
    super("View has not been created", {
      code: "view_not_created",
      title: "View Not Created",
      details:
        "The view has not been created yet and must be created before it can be updated.",
      ...options,
    });
  }
}
