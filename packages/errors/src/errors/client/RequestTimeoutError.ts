import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class RequestTimeoutError extends ClientError {
  public static readonly status = 408;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: RequestTimeoutError.status });
  }
}

errorRegistry.register(RequestTimeoutError);
