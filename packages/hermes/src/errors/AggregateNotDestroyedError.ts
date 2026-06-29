import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class AggregateNotDestroyedError extends DomainError {
  constructor(options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super("Aggregate has not been destroyed", {
      code: "aggregate_not_destroyed",
      title: "Aggregate Not Destroyed",
      details:
        "The aggregate is still active; this operation requires it to have been destroyed first.",
      ...options,
      permanent: true,
    });
  }
}
