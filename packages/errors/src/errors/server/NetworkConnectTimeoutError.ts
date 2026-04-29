import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class NetworkConnectTimeoutError extends ServerError {
  public static readonly status = 599;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: NetworkConnectTimeoutError.status });
  }
}

errorRegistry.register(NetworkConnectTimeoutError);
