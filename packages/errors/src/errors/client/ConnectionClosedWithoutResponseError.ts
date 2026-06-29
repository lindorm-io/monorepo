import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class ConnectionClosedWithoutResponseError extends ClientError {
  static readonly status = 444;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ConnectionClosedWithoutResponseError.status });
  }
}

errorRegistry.register(ConnectionClosedWithoutResponseError);
