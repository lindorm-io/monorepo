import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { OnValidate } from "./OnValidate";

describe("OnValidate Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @OnValidate(() => {})
    class OnValidateDecoratorMessage {}

    expect(globalMessageMetadata.get(OnValidateDecoratorMessage)).toMatchSnapshot();
  });
});
