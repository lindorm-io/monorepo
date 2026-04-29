import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class NotAcceptableError extends ClientError {
  public static readonly status = 406;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: NotAcceptableError.status });
  }
}

errorRegistry.register(NotAcceptableError);
