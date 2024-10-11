import { RabbitMessageBase } from "../classes";
import { IRabbitMessage } from "../interfaces";

export type TestMessageOptions = Partial<IRabbitMessage> & {
  name: string;
};

export class TestMessage extends RabbitMessageBase {
  public name: string;

  public constructor(options: TestMessageOptions) {
    super(options);

    this.name = options.name;
  }
}
