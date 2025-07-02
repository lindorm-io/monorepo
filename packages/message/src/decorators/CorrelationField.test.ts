import { globalMessageMetadata } from "../utils";
import { CorrelationField } from "./CorrelationField";
import { Message } from "./Message";

describe("CorrelationField Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class CorrelationFieldDecoratorMessage {
      @CorrelationField()
      correlation!: string;
    }

    expect(globalMessageMetadata.get(CorrelationFieldDecoratorMessage)).toMatchSnapshot();
  });
});
