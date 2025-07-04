import { globalMessageMetadata } from "../utils";
import { Field } from "./Field";
import { Message } from "./Message";
import { OnPublish } from "./OnPublish";

describe("OnPublish Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @OnPublish((message) => {
      console.log(message.test);
    })
    class OnPublishDecoratorMessage {
      @Field()
      test!: string;
    }

    expect(globalMessageMetadata.get(OnPublishDecoratorMessage)).toMatchSnapshot();
  });
});
