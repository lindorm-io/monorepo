import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class PreconditionFailedError extends ClientError {
  static readonly status = 412;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: PreconditionFailedError.status });
  }
}

errorRegistry.register(PreconditionFailedError);
