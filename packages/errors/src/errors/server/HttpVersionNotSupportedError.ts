import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class HttpVersionNotSupportedError extends ServerError {
  public static readonly status = 505;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: HttpVersionNotSupportedError.status });
  }
}

errorRegistry.register(HttpVersionNotSupportedError);
