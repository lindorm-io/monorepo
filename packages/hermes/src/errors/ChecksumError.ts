import { DomainError, type DomainErrorOptions } from "./DomainError.js";

export class ChecksumError extends DomainError {
  constructor(message: string, options: Omit<DomainErrorOptions, "permanent"> = {}) {
    super(message, { ...options, permanent: true });
  }
}
