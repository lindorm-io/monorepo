import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { Priority } from "./Priority";

describe("Priority Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @Priority(99)
    class PriorityDecoratorMessage {}

    expect(globalMessageMetadata.get(PriorityDecoratorMessage)).toMatchSnapshot();
  });
});
