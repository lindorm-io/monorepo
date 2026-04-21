import { buildMessageMetadata } from "../internal/message/metadata/build-message-metadata.js";
import { Field } from "./Field.js";
import { Message } from "./Message.js";
import { Nullable } from "./Nullable.js";
import { describe, expect, it } from "vitest";

describe("Nullable", () => {
  it("should stage field modifier with nullable true", () => {
    class TestMsg {
      @Nullable()
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      label!: string | null;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers).toHaveLength(1);
    expect(meta.fieldModifiers[0]).toMatchSnapshot();
  });

  it("should mark composed @Field as nullable", () => {
    @Message({ name: "NullableComposed" })
    class NullableComposed {
      @Nullable()
      @Field("string")
      label!: string | null;
    }

    const meta = buildMessageMetadata(NullableComposed);
    const field = meta.fields.find((f) => f.key === "label")!;
    expect(field.nullable).toBe(true);
  });

  it("should default nullable to false when decorator absent", () => {
    @Message({ name: "NullableAbsent" })
    class NullableAbsent {
      @Field("string")
      label!: string;
    }

    const meta = buildMessageMetadata(NullableAbsent);
    const field = meta.fields.find((f) => f.key === "label")!;
    expect(field.nullable).toBe(false);
  });
});
