import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class InsufficientStorageError extends ServerError {
  public static readonly status = 507;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: InsufficientStorageError.status });
  }
}

errorRegistry.register(InsufficientStorageError);
