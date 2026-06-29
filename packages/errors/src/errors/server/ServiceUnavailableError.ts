import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class ServiceUnavailableError extends ServerError {
  static readonly status = 503;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ServiceUnavailableError.status });
  }
}

errorRegistry.register(ServiceUnavailableError);
