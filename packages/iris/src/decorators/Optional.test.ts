import { buildMessageMetadata } from "../internal/message/metadata/build-message-metadata";
import { Field } from "./Field";
import { Message } from "./Message";
import { Optional } from "./Optional";

describe("Optional", () => {
  it("should stage field modifier with optional true", () => {
    class TestMsg {
      @Optional()
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      nickname!: string;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers).toHaveLength(1);
    expect(meta.fieldModifiers[0]).toMatchSnapshot();
  });

  it("should mark composed @Field as optional", () => {
    @Message({ name: "OptionalComposed" })
    class OptionalComposed {
      @Optional()
      @Field("string")
      nickname!: string;
    }

    const meta = buildMessageMetadata(OptionalComposed);
    const field = meta.fields.find((f) => f.key === "nickname")!;
    expect(field.optional).toBe(true);
  });

  it("should default optional to false when decorator absent", () => {
    @Message({ name: "OptionalAbsent" })
    class OptionalAbsent {
      @Field("string")
      nickname!: string;
    }

    const meta = buildMessageMetadata(OptionalAbsent);
    const field = meta.fields.find((f) => f.key === "nickname")!;
    expect(field.optional).toBe(false);
  });
});
