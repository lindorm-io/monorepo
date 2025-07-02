import { Message } from "../decorators";
import { globalMessageMetadata } from "../utils";
import { MessageBase } from "./MessageBase";

describe("MessageBase", () => {
  test("should have expected properties", () => {
    @Message()
    class TestMessageBase extends MessageBase {}

    expect(new TestMessageBase()).toMatchSnapshot();
    expect(globalMessageMetadata.get(TestMessageBase)).toMatchSnapshot();
  });
});
