import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class ProxyAuthenticationRequiredError extends ClientError {
  public static readonly status = 407;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ProxyAuthenticationRequiredError.status });
  }
}

errorRegistry.register(ProxyAuthenticationRequiredError);
