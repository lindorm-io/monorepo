import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class ClientClosedRequestError extends ClientError {
  public static readonly status = 499;

  public constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: ClientClosedRequestError.status });
  }
}

errorRegistry.register(ClientClosedRequestError);
