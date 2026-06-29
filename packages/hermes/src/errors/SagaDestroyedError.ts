import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class SagaDestroyedError extends DomainError {
  constructor(options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super("Saga is destroyed", {
      code: "saga_destroyed",
      title: "Saga Destroyed",
      details: "The saga has been destroyed and can no longer process messages.",
      ...options,
      permanent: true,
    });
  }
}
