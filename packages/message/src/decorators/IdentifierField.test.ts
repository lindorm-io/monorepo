import { globalMessageMetadata } from "../utils";
import { IdentifierField } from "./IdentifierField";
import { Message } from "./Message";

describe("IdentifierField Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class IdentifierFieldDecoratorMessage {
      @IdentifierField()
      id!: string;
    }

    expect(globalMessageMetadata.get(IdentifierFieldDecoratorMessage)).toMatchSnapshot();
  });
});
