import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class NotImplementedError extends ServerError {
  static readonly status = 501;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: NotImplementedError.status });
  }
}

errorRegistry.register(NotImplementedError);
