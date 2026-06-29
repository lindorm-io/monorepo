import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class AggregateAlreadyCreatedError extends DomainError {
  constructor(options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super("Aggregate has already been created", {
      code: "aggregate_already_created",
      title: "Aggregate Already Created",
      details: "The aggregate already exists and cannot be created again.",
      ...options,
      permanent: true,
    });
  }
}
