import { AmqpMessageBase } from "../../classes/AmqpMessageBase";

export type TestMessageTwoOptions = {
  data?: any;
  meta?: any;
};

export class TestMessageTwo extends AmqpMessageBase {
  public readonly data: any;
  public readonly meta: any;

  public constructor(options: TestMessageTwoOptions) {
    super();

    this.data = options.data;
    this.meta = options.meta;
  }

  public get topic(): string {
    return "override.test.message.two";
  }
}
