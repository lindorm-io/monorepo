import { RabbitMessageBase } from "../../classes/RabbitMessageBase";
import { IRabbitMessage } from "../../interfaces";
import { ValidateRabbitMessageFn } from "../../types";

export type TestMessageOneOptions = Partial<IRabbitMessage> & {
  data?: any;
  meta?: any;
};

export class TestMessageOne extends RabbitMessageBase {
  public readonly data: any;
  public readonly meta: any;

  public constructor(options: TestMessageOneOptions) {
    super(options);

    this.data = options.data;
    this.meta = options.meta;
  }

  public get topic(): string {
    return "override.test.message.one";
  }
}

export const validate: ValidateRabbitMessageFn<TestMessageOne> = (message) => {
  if (!message.data) {
    throw new Error("Missing data");
  }

  if (!message.meta) {
    throw new Error("Missing meta");
  }
};
