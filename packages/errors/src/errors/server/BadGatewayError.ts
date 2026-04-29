import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class BadGatewayError extends ServerError {
  public static readonly status = 502;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: BadGatewayError.status });
  }
}

errorRegistry.register(BadGatewayError);
