import { RabbitMessageBase } from "../../classes";
import { IRabbitMessage } from "../../interfaces";

export type TestMessageTwoOptions = Partial<IRabbitMessage> & {
  data?: any;
  meta?: any;
};

export class TestMessageTwo extends RabbitMessageBase {
  public readonly data: any;
  public readonly meta: any;

  public constructor(options: TestMessageTwoOptions) {
    super(options);

    this.data = options.data;
    this.meta = options.meta;
  }

  public get topic(): string {
    return "override.test.message.two";
  }
}
