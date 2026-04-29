import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class RequestUriTooLongError extends ClientError {
  public static readonly status = 414;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: RequestUriTooLongError.status });
  }
}

errorRegistry.register(RequestUriTooLongError);
