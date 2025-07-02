import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { OnCreate } from "./OnCreate";

describe("OnCreate Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @OnCreate(() => {})
    class OnCreateDecoratorMessage {}

    expect(globalMessageMetadata.get(OnCreateDecoratorMessage)).toMatchSnapshot();
  });
});
