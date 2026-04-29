import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class PayloadTooLargeError extends ClientError {
  public static readonly status = 413;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: PayloadTooLargeError.status });
  }
}

errorRegistry.register(PayloadTooLargeError);
