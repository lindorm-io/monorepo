import { globalMessageMetadata } from "../utils";
import { MandatoryField } from "./MandatoryField";
import { Message } from "./Message";

describe("MandatoryField Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class MandatoryFieldDecoratorMessage {
      @MandatoryField()
      mandatory!: boolean;
    }

    expect(globalMessageMetadata.get(MandatoryFieldDecoratorMessage)).toMatchSnapshot();
  });
});
