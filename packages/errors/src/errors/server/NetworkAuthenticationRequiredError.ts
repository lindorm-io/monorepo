import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class NetworkAuthenticationRequiredError extends ServerError {
  public static readonly status = 511;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: NetworkAuthenticationRequiredError.status });
  }
}

errorRegistry.register(NetworkAuthenticationRequiredError);
