import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class UnauthorizedError extends ClientError {
  static readonly status = 401;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: UnauthorizedError.status });
  }
}

errorRegistry.register(UnauthorizedError);
