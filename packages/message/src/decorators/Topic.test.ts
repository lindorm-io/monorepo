import { globalMessageMetadata } from "../utils";
import { Field } from "./Field";
import { Message } from "./Message";
import { Topic } from "./Topic";

describe("Topic Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @Topic((message) => message.test)
    class TopicDecoratorMessage {
      @Field()
      test!: string;
    }

    expect(globalMessageMetadata.get(TopicDecoratorMessage)).toMatchSnapshot();
  });
});
