import { globalMessageMetadata } from "../utils";
import { DelayField } from "./DelayField";
import { Message } from "./Message";

describe("DelayField Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class DelayFieldDecoratorMessage {
      @DelayField()
      delay!: number;
    }

    expect(globalMessageMetadata.get(DelayFieldDecoratorMessage)).toMatchSnapshot();
  });
});
