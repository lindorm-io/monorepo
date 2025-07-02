import { globalMessageMetadata } from "../utils";
import { Field } from "./Field";
import { Generated } from "./Generated";
import { Message } from "./Message";

describe("Generated Decorator", () => {
  test("should add metadata", () => {
    @Message()
    class GeneratedDecoratorMessage {
      @Field()
      @Generated("date")
      date!: Date;

      @Field()
      @Generated("float")
      float!: number;

      @Field()
      @Generated("integer")
      integer!: number;

      @Field()
      @Generated("string")
      string!: string;

      @Field()
      @Generated("uuid")
      uuid!: string;

      @Field()
      @Generated({ strategy: "integer", max: 4, min: 4 })
      special!: string;

      @Field()
      @Generated({ strategy: "string", length: 32 })
      length!: number;
    }

    expect(globalMessageMetadata.get(GeneratedDecoratorMessage)).toMatchSnapshot();
  });
});
