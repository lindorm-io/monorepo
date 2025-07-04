import { globalMessageMetadata } from "../utils";
import { Field } from "./Field";
import { Message } from "./Message";
import { OnCreate } from "./OnCreate";

describe("OnCreate Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @OnCreate((message) => {
      console.log(message.test);
    })
    class OnCreateDecoratorMessage {
      @Field()
      test!: string;
    }

    expect(globalMessageMetadata.get(OnCreateDecoratorMessage)).toMatchSnapshot();
  });
});
