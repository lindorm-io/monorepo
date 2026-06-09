import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class AggregateDestroyedError extends DomainError {
  public constructor(options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super("Aggregate is destroyed", {
      code: "aggregate_destroyed",
      title: "Aggregate Destroyed",
      details:
        "The aggregate has been destroyed and can no longer process commands or apply events.",
      ...options,
      permanent: true,
    });
  }
}
