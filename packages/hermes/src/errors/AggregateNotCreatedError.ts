import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class AggregateNotCreatedError extends DomainError {
  public constructor(options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super("Aggregate has not been created", {
      code: "aggregate_not_created",
      title: "Aggregate Not Created",
      details:
        "The aggregate has not been created yet and must be created before it can handle this operation.",
      ...options,
      permanent: true,
    });
  }
}
