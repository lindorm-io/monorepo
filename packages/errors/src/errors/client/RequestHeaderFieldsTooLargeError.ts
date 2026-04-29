import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class RequestHeaderFieldsTooLargeError extends ClientError {
  public static readonly status = 431;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: RequestHeaderFieldsTooLargeError.status });
  }
}

errorRegistry.register(RequestHeaderFieldsTooLargeError);
