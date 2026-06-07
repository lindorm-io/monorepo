import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

export class HandlerNotRegisteredError extends LindormError {
  public static readonly namespace = "hermes";

  public constructor(
    message = "Handler has not been registered",
    options: LindormErrorOptions = {},
  ) {
    super(message, options);
  }
}
