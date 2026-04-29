import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class ConflictError extends ClientError {
  public static readonly status = 409;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ConflictError.status });
  }
}

errorRegistry.register(ConflictError);
