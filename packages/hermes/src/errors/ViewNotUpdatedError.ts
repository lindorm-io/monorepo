import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class ViewNotUpdatedError extends DomainError {
  constructor(message?: string, options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super(message ?? "View was not updated", {
      code: "view_not_updated",
      title: "View Not Updated",
      details: "The view could not be updated for the requested revision.",
      ...options,
      permanent: true,
    });
  }
}
