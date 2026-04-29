import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class ExpectationFailedError extends ClientError {
  public static readonly status = 417;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ExpectationFailedError.status });
  }
}

errorRegistry.register(ExpectationFailedError);
