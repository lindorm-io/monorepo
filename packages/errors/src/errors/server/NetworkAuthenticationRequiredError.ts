import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class NetworkAuthenticationRequiredError extends ServerError {
  static readonly status = 511;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: NetworkAuthenticationRequiredError.status });
  }
}

errorRegistry.register(NetworkAuthenticationRequiredError);
