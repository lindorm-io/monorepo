import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class VariantAlsoNegotiatesError extends ServerError {
  public static readonly status = 506;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: VariantAlsoNegotiatesError.status });
  }
}

errorRegistry.register(VariantAlsoNegotiatesError);
