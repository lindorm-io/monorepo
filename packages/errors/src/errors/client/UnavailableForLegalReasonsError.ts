import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class UnavailableForLegalReasonsError extends ClientError {
  public static readonly status = 451;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: UnavailableForLegalReasonsError.status });
  }
}

errorRegistry.register(UnavailableForLegalReasonsError);
