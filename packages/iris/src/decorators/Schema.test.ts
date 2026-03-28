import { z } from "zod/v4";
import { Schema } from "./Schema";

describe("Schema", () => {
  it("should stage field modifier with schema", () => {
    const schema = z.string().min(1);

    class TestMsg {
      @Schema(schema)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      name!: string;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers).toHaveLength(1);
    expect(meta.fieldModifiers[0].key).toBe("name");
    expect(meta.fieldModifiers[0].decorator).toBe("Schema");
    expect(meta.fieldModifiers[0].schema).toBe(schema);
  });
});
