export abstract class ExtendableError extends Error {
  protected constructor(message: string) {
    super(message);

    this.name = this.constructor.name;

    if (
      Error.captureStackTrace instanceof Function ||
      typeof Error.captureStackTrace === "function"
    ) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
}
