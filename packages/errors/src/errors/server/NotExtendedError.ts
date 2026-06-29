import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class NotExtendedError extends ServerError {
  static readonly status = 510;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: NotExtendedError.status });
  }
}

errorRegistry.register(NotExtendedError);
