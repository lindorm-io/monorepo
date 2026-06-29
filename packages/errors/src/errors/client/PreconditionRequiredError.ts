import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class PreconditionRequiredError extends ClientError {
  static readonly status = 428;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: PreconditionRequiredError.status });
  }
}

errorRegistry.register(PreconditionRequiredError);
