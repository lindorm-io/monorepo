import { isFunction } from "lodash";

export abstract class ExtendableError extends Error {
  protected constructor(message: string) {
    super(message);

    this.name = this.constructor.name;

    if (isFunction(Error.captureStackTrace)) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
}
