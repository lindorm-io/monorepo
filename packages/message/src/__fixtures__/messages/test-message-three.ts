import { IMessage } from "../../interfaces";

export type TestMessageThreeOptions = Partial<IMessage> & {
  name: string;
};

export class TestMessageThree {
  public name: string;

  public constructor(options: TestMessageThreeOptions) {
    this.name = options.name;
  }
}
