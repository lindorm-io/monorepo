import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { OnPublish } from "./OnPublish";

describe("OnPublish Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @OnPublish(() => {})
    class OnPublishDecoratorMessage {}

    expect(globalMessageMetadata.get(OnPublishDecoratorMessage)).toMatchSnapshot();
  });
});
