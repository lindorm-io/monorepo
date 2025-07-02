import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { TimestampField } from "./TimestampField";

describe("TimestampField Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class TimestampFieldDecoratorMessage {
      @TimestampField()
      timestamp!: Date;
    }

    expect(globalMessageMetadata.get(TimestampFieldDecoratorMessage)).toMatchSnapshot();
  });
});
