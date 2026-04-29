import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class BadRequestError extends ClientError {
  public static readonly status = 400;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: BadRequestError.status });
  }
}

errorRegistry.register(BadRequestError);
