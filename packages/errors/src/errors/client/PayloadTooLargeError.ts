import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class PayloadTooLargeError extends ClientError {
  static readonly status = 413;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: PayloadTooLargeError.status });
  }
}

errorRegistry.register(PayloadTooLargeError);
