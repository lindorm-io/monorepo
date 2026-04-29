import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class UnprocessableEntityError extends ClientError {
  public static readonly status = 422;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: UnprocessableEntityError.status });
  }
}

errorRegistry.register(UnprocessableEntityError);
