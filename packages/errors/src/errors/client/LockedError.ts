import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class LockedError extends ClientError {
  public static readonly status = 423;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: LockedError.status });
  }
}

errorRegistry.register(LockedError);
