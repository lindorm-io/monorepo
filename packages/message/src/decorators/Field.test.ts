import { globalMessageMetadata } from "../utils";
import { Field } from "./Field";
import { Message } from "./Message";

describe("Field Decorator", () => {
  test("should add metadata", () => {
    enum TestEnum {
      One = "1",
      Two = "2",
    }

    @Message()
    class FieldDecoratorMessage {
      @Field({ nullable: true })
      name!: string | null;

      @Field("boolean")
      empty!: boolean;

      @Field("array")
      array!: Array<string>;

      @Field({ nullable: true, type: "boolean" })
      boolean!: boolean | null;

      @Field("date")
      date!: Date;

      @Field("enum", { enum: TestEnum })
      enum!: TestEnum;
    }

    expect(globalMessageMetadata.get(FieldDecoratorMessage)).toMatchSnapshot();
  });
});
