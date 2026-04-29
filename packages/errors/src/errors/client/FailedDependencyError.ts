import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class FailedDependencyError extends ClientError {
  public static readonly status = 424;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: FailedDependencyError.status });
  }
}

errorRegistry.register(FailedDependencyError);
