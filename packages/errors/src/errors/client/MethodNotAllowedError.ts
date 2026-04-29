import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class MethodNotAllowedError extends ClientError {
  public static readonly status = 405;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: MethodNotAllowedError.status });
  }
}

errorRegistry.register(MethodNotAllowedError);
