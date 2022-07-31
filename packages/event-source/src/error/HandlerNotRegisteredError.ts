import { LindormError } from "@lindorm-io/errors";

export class HandlerNotRegisteredError extends LindormError {
  public constructor() {
    super("Handler has not been registered");
  }
}
