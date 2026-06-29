import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class ForbiddenError extends ClientError {
  static readonly status = 403;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ForbiddenError.status });
  }
}

errorRegistry.register(ForbiddenError);
