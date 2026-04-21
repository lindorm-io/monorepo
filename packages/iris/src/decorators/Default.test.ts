import { buildMessageMetadata } from "../internal/message/metadata/build-message-metadata";
import { Default } from "./Default";
import { Field } from "./Field";
import { Message } from "./Message";
import { describe, expect, it } from "vitest";

describe("Default", () => {
  it("should stage field modifier with literal default", () => {
    class TestMsg {
      @Default("active")
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      status!: string;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers).toHaveLength(1);
    expect(meta.fieldModifiers[0]).toMatchSnapshot();
  });

  it("should apply literal default to composed @Field", () => {
    @Message({ name: "DefaultLiteral" })
    class DefaultLiteral {
      @Default("active")
      @Field("string")
      status!: string;
    }

    const meta = buildMessageMetadata(DefaultLiteral);
    const field = meta.fields.find((f) => f.key === "status")!;
    expect(field.default).toBe("active");
  });

  it("should preserve factory function identity", () => {
    const factory = () => "generated";

    @Message({ name: "DefaultFactory" })
    class DefaultFactory {
      @Default(factory)
      @Field("string")
      code!: string;
    }

    const meta = buildMessageMetadata(DefaultFactory);
    const field = meta.fields.find((f) => f.key === "code")!;
    expect(field.default).toBe(factory);
  });

  it("should preserve falsy defaults (zero, false, empty string)", () => {
    @Message({ name: "DefaultFalsy" })
    class DefaultFalsy {
      @Default(0)
      @Field("integer")
      count!: number;

      @Default(false)
      @Field("boolean")
      active!: boolean;

      @Default("")
      @Field("string")
      label!: string;
    }

    const meta = buildMessageMetadata(DefaultFalsy);
    expect(meta.fields.find((f) => f.key === "count")!.default).toBe(0);
    expect(meta.fields.find((f) => f.key === "active")!.default).toBe(false);
    expect(meta.fields.find((f) => f.key === "label")!.default).toBe("");
  });

  it("should preserve null as default value", () => {
    @Message({ name: "DefaultNull" })
    class DefaultNull {
      @Default(null)
      @Field("string")
      label!: string | null;
    }

    const meta = buildMessageMetadata(DefaultNull);
    const field = meta.fields.find((f) => f.key === "label")!;
    expect(field.default).toBeNull();
  });
});
