import { RabbitMessageBase } from "../classes/RabbitMessageBase";

export type TestMessageOptions = {
  name: string;
};

export class TestMessage extends RabbitMessageBase {
  public name: string;

  public constructor(options: TestMessageOptions) {
    super();

    this.name = options.name;
  }
}
