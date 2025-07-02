import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { OnConsume } from "./OnConsume";

describe("OnConsume Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @OnConsume(() => {})
    class OnConsumeDecoratorMessage {}

    expect(globalMessageMetadata.get(OnConsumeDecoratorMessage)).toMatchSnapshot();
  });
});
