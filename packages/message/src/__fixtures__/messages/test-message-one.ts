import { IMessage } from "../../interfaces";

export type TestMessageOneOptions = Partial<IMessage> & {
  data?: any;
  meta?: any;
};

export class TestMessageOne {
  public readonly data: any;
  public readonly meta: any;

  public constructor(options: TestMessageOneOptions) {
    this.data = options.data;
    this.meta = options.meta;
  }
}
