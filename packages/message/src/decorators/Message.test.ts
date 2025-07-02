import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";

describe("Message Decorator", () => {
  test("should add metadata", () => {
    @Message({
      name: "name",
      namespace: "namespace",
      topic: "topic",
    })
    class MessageDecoratorMessage {}

    expect(globalMessageMetadata.get(MessageDecoratorMessage)).toMatchSnapshot();
  });
});
