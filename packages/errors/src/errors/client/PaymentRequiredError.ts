import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class PaymentRequiredError extends ClientError {
  static readonly status = 402;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: PaymentRequiredError.status });
  }
}

errorRegistry.register(PaymentRequiredError);
