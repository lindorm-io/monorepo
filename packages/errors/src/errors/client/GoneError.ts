import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class GoneError extends ClientError {
  static readonly status = 410;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: GoneError.status });
  }
}

errorRegistry.register(GoneError);
