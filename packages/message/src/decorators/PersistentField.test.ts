import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { PersistentField } from "./PersistentField";

describe("PersistentField Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class PersistentFieldDecoratorMessage {
      @PersistentField()
      persistent!: boolean;
    }

    expect(globalMessageMetadata.get(PersistentFieldDecoratorMessage)).toMatchSnapshot();
  });
});
