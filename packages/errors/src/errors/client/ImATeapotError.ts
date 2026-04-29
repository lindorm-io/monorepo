import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class ImATeapotError extends ClientError {
  public static readonly status = 418;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ImATeapotError.status });
  }
}

errorRegistry.register(ImATeapotError);
