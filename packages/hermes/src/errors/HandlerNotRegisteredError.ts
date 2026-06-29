import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

export class HandlerNotRegisteredError extends LindormError {
  static readonly namespace = "hermes";

  constructor(
    message = "Handler has not been registered",
    options: LindormErrorOptions = {},
  ) {
    super(message, options);
  }
}
