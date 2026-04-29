import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class ForbiddenError extends ClientError {
  public static readonly status = 403;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ForbiddenError.status });
  }
}

errorRegistry.register(ForbiddenError);
