import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ServerError } from "../ServerError.js";

export class LoopDetectedError extends ServerError {
  public static readonly status = 508;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: LoopDetectedError.status });
  }
}

errorRegistry.register(LoopDetectedError);
