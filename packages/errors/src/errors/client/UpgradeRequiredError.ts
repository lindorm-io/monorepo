import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class UpgradeRequiredError extends ClientError {
  static readonly status = 426;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: UpgradeRequiredError.status });
  }
}

errorRegistry.register(UpgradeRequiredError);
