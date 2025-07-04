import { globalMessageMetadata } from "../utils";
import { Field } from "./Field";
import { Message } from "./Message";
import { OnConsume } from "./OnConsume";

describe("OnConsume Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @OnConsume((message) => {
      console.log(message.test);
    })
    class OnConsumeDecoratorMessage {
      @Field()
      test!: string;
    }

    expect(globalMessageMetadata.get(OnConsumeDecoratorMessage)).toMatchSnapshot();
  });
});
