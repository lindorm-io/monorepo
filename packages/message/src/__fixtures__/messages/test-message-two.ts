import { IMessage } from "../../interfaces";

export type TestMessageTwoOptions = Partial<IMessage> & {
  data?: any;
  meta?: any;
};

export class TestMessageTwo {
  public readonly data: any;
  public readonly meta: any;

  public constructor(options: TestMessageTwoOptions) {
    this.data = options.data;
    this.meta = options.meta;
  }
}
