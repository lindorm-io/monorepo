import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class GatewayTimeoutError extends ServerError {
  public static readonly status = 504;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: GatewayTimeoutError.status });
  }
}

errorRegistry.register(GatewayTimeoutError);
