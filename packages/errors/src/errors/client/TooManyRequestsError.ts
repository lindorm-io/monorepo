import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class TooManyRequestsError extends ClientError {
  public static readonly status = 429;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: TooManyRequestsError.status });
  }
}

errorRegistry.register(TooManyRequestsError);
