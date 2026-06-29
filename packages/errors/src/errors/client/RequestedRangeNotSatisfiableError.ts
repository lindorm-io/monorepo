import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class RequestedRangeNotSatisfiableError extends ClientError {
  static readonly status = 416;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: RequestedRangeNotSatisfiableError.status });
  }
}

errorRegistry.register(RequestedRangeNotSatisfiableError);
