import { errorRegistry } from "../registry/ErrorRegistry.js";
import type { HttpErrorOptions } from "../types/HttpErrorOptions.js";
import { LindormError } from "./LindormError.js";

export class NetworkError extends LindormError {
  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, { ...options, status: -1 });
  }
}

errorRegistry.register(NetworkError);
