import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class LockedError extends ClientError {
  static readonly status = 423;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: LockedError.status });
  }
}

errorRegistry.register(LockedError);
