import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class ViewDestroyedError extends DomainError {
  constructor(options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super("View is destroyed", {
      code: "view_destroyed",
      title: "View Destroyed",
      details: "The view has been destroyed and can no longer be updated or queried.",
      ...options,
      permanent: true,
    });
  }
}
