import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class LengthRequiredError extends ClientError {
  public static readonly status = 411;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: LengthRequiredError.status });
  }
}

errorRegistry.register(LengthRequiredError);
