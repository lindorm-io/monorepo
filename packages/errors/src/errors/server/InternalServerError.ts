import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class InternalServerError extends ServerError {
  public static readonly status = 500;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: InternalServerError.status });
  }
}

errorRegistry.register(InternalServerError);
