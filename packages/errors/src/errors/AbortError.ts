import { LindormError, type LindormErrorOptions } from "./LindormError.js";

export type AbortErrorOptions = LindormErrorOptions & { reason?: unknown };

export class AbortError extends LindormError {
  public readonly reason: unknown;

  public constructor(
    message: string = "Operation aborted",
    options: AbortErrorOptions = {},
  ) {
    super(message, {
      status: 499,
      title: "Client Closed Request",
      ...options,
    });

    this.reason = options.reason;
  }
}
