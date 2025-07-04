import { globalMessageMetadata } from "../utils";
import { Field } from "./Field";
import { Message } from "./Message";
import { OnValidate } from "./OnValidate";

describe("OnValidate Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @OnValidate((message) => {
      console.log(message.test);
    })
    class OnValidateDecoratorMessage {
      @Field()
      test!: string;
    }

    expect(globalMessageMetadata.get(OnValidateDecoratorMessage)).toMatchSnapshot();
  });
});
