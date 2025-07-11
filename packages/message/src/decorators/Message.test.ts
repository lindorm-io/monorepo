import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";

describe("Message Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class MessageDecoratorMessage {}

    expect(globalMessageMetadata.get(MessageDecoratorMessage)).toMatchSnapshot();
  });

  test("should add metadata with options", () => {
    @Message({
      name: "name",
      namespace: "namespace",
      topic: "topic",
    })
    class MessageDecoratorMessageWithOptions {}

    expect(
      globalMessageMetadata.get(MessageDecoratorMessageWithOptions),
    ).toMatchSnapshot();
  });
});
