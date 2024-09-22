import { RabbitMessageBase } from "../../classes/RabbitMessageBase";
import { ValidateMessageFn } from "../../types";

export type TestMessageOneOptions = {
  data?: any;
  meta?: any;
};

export class TestMessageOne extends RabbitMessageBase {
  public readonly data: any;
  public readonly meta: any;

  public constructor(options: TestMessageOneOptions) {
    super();

    this.data = options.data;
    this.meta = options.meta;
  }

  public get topic(): string {
    return "override.test.message.one";
  }
}

export const validate: ValidateMessageFn<TestMessageOne> = (message) => {
  if (!message.data) {
    throw new Error("Missing data");
  }

  if (!message.meta) {
    throw new Error("Missing meta");
  }
};
