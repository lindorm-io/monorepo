import { LindormError, LindormErrorOptions } from "./LindormError";

interface Options extends LindormErrorOptions {
  statusCode: number;
}

export abstract class HttpStatusError extends LindormError {
  public readonly statusCode: number;

  protected constructor(message: string, options: Options) {
    super(message, options);

    this.statusCode = options.statusCode;
  }
}
