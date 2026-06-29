import { errorRegistry } from "../../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../../types/HttpErrorOptions.js";
import { ClientError } from "../ClientError.js";

export class MisdirectedRequestError extends ClientError {
  static readonly status = 421;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: MisdirectedRequestError.status });
  }
}

errorRegistry.register(MisdirectedRequestError);
