import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class UnsupportedMediaTypeError extends ClientError {
  static readonly status = 415;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: UnsupportedMediaTypeError.status });
  }
}

errorRegistry.register(UnsupportedMediaTypeError);
