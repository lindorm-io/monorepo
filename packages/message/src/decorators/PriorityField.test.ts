import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { PriorityField } from "./PriorityField";

describe("PriorityField Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class PriorityFieldDecoratorMessage {
      @PriorityField()
      priority!: number;
    }

    expect(globalMessageMetadata.get(PriorityFieldDecoratorMessage)).toMatchSnapshot();
  });
});
