import { LindormError } from "@lindorm/errors";

export class InvalidMessageTypeError extends LindormError {
  public constructor(message: any, expect: any) {
    super("Message is not a valid type", {
      debug: {
        expect: typeof expect,
        actual: typeof message,
      },
    });
  }
}
