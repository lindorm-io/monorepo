import { AmqpMessageBase } from "../classes/AmqpMessageBase";

export type TestMessageOptions = {
  name: string;
};

export class TestMessage extends AmqpMessageBase {
  public name: string;

  public constructor(options: TestMessageOptions) {
    super();

    this.name = options.name;
  }
}
