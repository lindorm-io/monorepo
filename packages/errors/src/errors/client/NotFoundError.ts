import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class NotFoundError extends ClientError {
  static readonly status = 404;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: NotFoundError.status });
  }
}

errorRegistry.register(NotFoundError);
