import { z } from "zod";
import { globalMessageMetadata } from "../utils";
import { Message } from "./Message";
import { Schema } from "./Schema";

describe("Schema Decorator", () => {
  test("should add metadata", () => {
    @Message()
    @Schema(z.object({ name: z.string() }))
    class SchemaDecoratorMessage {}

    expect(globalMessageMetadata.get(SchemaDecoratorMessage)).toMatchSnapshot();
  });
});
