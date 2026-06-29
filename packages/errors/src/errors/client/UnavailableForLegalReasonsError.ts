import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class UnavailableForLegalReasonsError extends ClientError {
  static readonly status = 451;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: UnavailableForLegalReasonsError.status });
  }
}

errorRegistry.register(UnavailableForLegalReasonsError);
