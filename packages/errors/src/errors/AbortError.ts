import { LindormError, type LindormErrorOptions } from "./LindormError.js";

export type AbortErrorOptions = LindormErrorOptions & { reason?: unknown };

export class AbortError extends LindormError {
  readonly reason: unknown;

  constructor(message: string = "Operation aborted", options: AbortErrorOptions = {}) {
    super(message, {
      status: 499,
      title: "Client Closed Request",
      ...options,
    });

    this.reason = options.reason;
  }
}
