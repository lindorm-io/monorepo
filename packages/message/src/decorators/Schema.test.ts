import { z } from "zod";
import { globalMessageMetadata } from "../utils";
import { Field } from "./Field";
import { Message } from "./Message";
import { Schema } from "./Schema";

describe("Schema Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @Schema(z.object({ name: z.string() }))
    class SchemaDecoratorMessage {
      @Field()
      public name!: string;
    }

    expect(globalMessageMetadata.get(SchemaDecoratorMessage)).toMatchSnapshot();
  });
});
