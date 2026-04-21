import { IrisMetadataError } from "../errors/index.js";
import { findMessageByName } from "../internal/message/metadata/registry.js";
import { AbstractMessage } from "./AbstractMessage.js";
import { Broadcast } from "./Broadcast.js";
import { Compressed } from "./Compressed.js";
import { Default } from "./Default.js";
import { Enum } from "./Enum.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { Header } from "./Header.js";
import { Max } from "./Max.js";
import { Message } from "./Message.js";
import { Min } from "./Min.js";
import { Namespace } from "./Namespace.js";
import { OnCreate } from "./OnCreate.js";
import { Transform } from "./Transform.js";
import { describe, expect, it } from "vitest";

describe("negative and edge-case decorator usage", () => {
  describe("duplicate @Message on same class", () => {
    it("should overwrite message metadata with the last decorator applied", () => {
      @Message({ name: "FirstName" })
      @Message({ name: "SecondName" })
      class DualMessage {}

      const meta = (DualMessage as any)[Symbol.metadata];
      expect(meta.message).toMatchSnapshot();
    });

    it("should register the last-applied name in the registry", () => {
      @Message({ name: "RegFirst" })
      @Message({ name: "RegSecond" })
      class DualReg {}

      expect(findMessageByName("RegFirst")).toBe(DualReg);
      expect(findMessageByName("RegSecond")).toBe(DualReg);
    });
  });

  describe("@Message with edge-case options", () => {
    it("should reject empty string name", () => {
      expect(() => {
        @Message({ name: "" })
        class EmptyName {}
      }).toThrow(IrisMetadataError);
    });

    it("should use class name when name is undefined", () => {
      @Message({ name: undefined })
      class UndefinedName {}

      const meta = (UndefinedName as any)[Symbol.metadata];
      expect(meta.message.name).toBe("UndefinedName");
    });

    it("should default to class name when no options provided", () => {
      @Message()
      class AutoNamed {}

      const meta = (AutoNamed as any)[Symbol.metadata];
      expect(meta.message.name).toBe("AutoNamed");
    });
  });

  describe("@Namespace edge cases", () => {
    it("should reject empty namespace", () => {
      expect(() => {
        @Namespace("")
        @Message({ name: "NsTest" })
        class EmptyNs {}
      }).toThrow(IrisMetadataError);
    });

    it("should not have namespace when not decorated", () => {
      @Message()
      class NoNs {}

      const meta = (NoNs as any)[Symbol.metadata];
      expect(meta.namespace).toBeUndefined();
    });
  });

  describe("@Field with edge-case options", () => {
    it("should stage field with type", () => {
      class TypedField {
        @Field("string")
        data!: string;
      }

      const meta = (TypedField as any)[Symbol.metadata];
      expect(meta.fields[0].type).toBe("string");
    });

    it("should handle min/max of zero via @Min/@Max modifiers", () => {
      class ZeroBounds {
        @Min(0)
        @Max(0)
        @Field("integer")
        value!: number;
      }

      const meta = (ZeroBounds as any)[Symbol.metadata];
      expect(meta.fieldModifiers).toHaveLength(2);
    });

    it("should handle negative min/max via @Min/@Max modifiers", () => {
      class NegBounds {
        @Min(-100)
        @Max(-1)
        @Field("float")
        temperature!: number;
      }

      const meta = (NegBounds as any)[Symbol.metadata];
      expect(meta.fieldModifiers).toHaveLength(2);
    });

    it("should accept default value of false", () => {
      class FalseDefault {
        @Default(false)
        @Field("boolean")
        active!: boolean;
      }

      const meta = (FalseDefault as any)[Symbol.metadata];
      expect(meta.fieldModifiers[0].default).toBe(false);
    });

    it("should accept default value of zero", () => {
      class ZeroDefault {
        @Default(0)
        @Field("integer")
        count!: number;
      }

      const meta = (ZeroDefault as any)[Symbol.metadata];
      expect(meta.fieldModifiers[0].default).toBe(0);
    });

    it("should accept default value of empty string", () => {
      class EmptyDefault {
        @Default("")
        @Field("string")
        label!: string;
      }

      const meta = (EmptyDefault as any)[Symbol.metadata];
      expect(meta.fieldModifiers[0].default).toBe("");
    });

    it("should accept a function default", () => {
      const factory = () => [];

      class FnDefault {
        @Default(factory)
        @Field("array")
        items!: Array<unknown>;
      }

      const meta = (FnDefault as any)[Symbol.metadata];
      expect(meta.fieldModifiers[0].default).toBe(factory);
    });

    it("should accept @Enum as a standalone modifier", () => {
      const StatusEnum = { Active: "active", Inactive: "inactive" } as const;

      class EnumField {
        @Enum(StatusEnum)
        @Field("enum")
        status!: string;
      }

      const meta = (EnumField as any)[Symbol.metadata];
      expect(meta.fieldModifiers).toHaveLength(1);
      expect(meta.fieldModifiers[0].enum).toEqual(StatusEnum);
    });
  });

  describe("@Generated with edge-case options", () => {
    it("should handle zero length", () => {
      class ZeroLen {
        @Generated("string", { length: 0 })
        code!: string;
      }

      const meta = (ZeroLen as any)[Symbol.metadata];
      expect(meta.generated[0].length).toBe(0);
    });

    it("should handle negative range values", () => {
      class NegRange {
        @Generated("integer", { min: -999, max: -1 })
        value!: number;
      }

      const meta = (NegRange as any)[Symbol.metadata];
      expect(meta.generated[0].min).toBe(-999);
      expect(meta.generated[0].max).toBe(-1);
    });
  });

  describe("@Header with edge-case names", () => {
    it("should reject empty string as header name", () => {
      expect(() => {
        class EmptyHeader {
          @Header("")
          field!: string;
        }
      }).toThrow(IrisMetadataError);
    });

    it("should use field name when no argument provided", () => {
      class DefaultHeader {
        @Header()
        myField!: string;
      }

      const meta = (DefaultHeader as any)[Symbol.metadata];
      expect(meta.headers[0].headerName).toBe("myField");
      expect(meta.headers[0].key).toBe("myField");
    });
  });

  describe("@Transform edge cases", () => {
    it("should stage as a transform entry, not a field", () => {
      const to = (v: unknown) => v;
      const from = (v: unknown) => v;

      class TransformMsg {
        @Transform({ to, from })
        data!: unknown;
      }

      const meta = (TransformMsg as any)[Symbol.metadata];
      expect(meta.fields).toBeUndefined();
      expect(meta.transforms).toHaveLength(1);
      expect(meta.transforms[0].key).toBe("data");
      expect(meta.transforms[0].transform.to).toBe(to);
      expect(meta.transforms[0].transform.from).toBe(from);
    });
  });

  describe("@AbstractMessage does not register in message registry", () => {
    it("should not be findable by name", () => {
      @AbstractMessage()
      class AbstractOnly {}

      expect(findMessageByName("AbstractOnly")).toBeUndefined();
    });

    it("should set __abstract flag and stage message metadata", () => {
      @AbstractMessage()
      class PureAbstract {}

      const meta = (PureAbstract as any)[Symbol.metadata];
      expect(meta.__abstract).toBe(true);
      expect(meta.message).toMatchSnapshot();
    });
  });

  describe("combining @AbstractMessage and @Message on same class", () => {
    it("should throw when @AbstractMessage is applied after @Message", () => {
      expect(() => {
        @AbstractMessage()
        @Message({ name: "BothDecorators" })
        class Both {}
      }).toThrow(IrisMetadataError);
    });

    it("should throw when @Message is applied after @AbstractMessage", () => {
      expect(() => {
        @Message({ name: "BothDecorators" })
        @AbstractMessage()
        class Both {}
      }).toThrow(IrisMetadataError);
    });
  });

  describe("class with no decorators at all", () => {
    it("should have no Symbol.metadata or undefined metadata", () => {
      class Plain {}

      const meta = (Plain as any)[Symbol.metadata];
      if (meta != null) {
        expect(meta.fields).toBeUndefined();
        expect(meta.message).toBeUndefined();
        expect(meta.hooks).toBeUndefined();
      } else {
        expect(meta).toBeUndefined();
      }
    });
  });

  describe("decorator on class with no fields", () => {
    it("should have message metadata but empty field arrays", () => {
      @Message({ name: "EmptyMsg" })
      class EmptyMsg {}

      const meta = (EmptyMsg as any)[Symbol.metadata];
      expect(meta.message.name).toBe("EmptyMsg");
      expect(meta.fields).toBeUndefined();
    });
  });

  describe("multiple class decorators stacking", () => {
    it("should accumulate all class-level singleton metadata", () => {
      @Message({ name: "FullyDecorated" })
      @Broadcast()
      @Compressed("brotli")
      @OnCreate(() => {})
      class FullyDecorated {
        @Field("string")
        data!: string;
      }

      const meta = (FullyDecorated as any)[Symbol.metadata];
      expect(meta.message.name).toBe("FullyDecorated");
      expect(meta.broadcast).toBe(true);
      expect(meta.compressed).toMatchSnapshot();
      expect(meta.hooks).toHaveLength(1);
      expect(meta.fields).toHaveLength(1);
    });
  });

  describe("@Field and @Header on the same property name across separate classes", () => {
    it("should not conflict between independent classes", () => {
      class MsgA {
        @Field("string")
        shared!: string;
      }

      class MsgB {
        @Header("x-shared")
        shared!: string;
      }

      const metaA = (MsgA as any)[Symbol.metadata];
      const metaB = (MsgB as any)[Symbol.metadata];

      expect(metaA.fields).toHaveLength(1);
      expect(metaA.headers).toBeUndefined();

      expect(metaB.headers).toHaveLength(1);
      expect(metaB.fields).toBeUndefined();
    });
  });

  describe("@Field and @Transform on same field in same class", () => {
    it("should stage one field and one transform entry", () => {
      const to = (v: unknown) => v;
      const from = (v: unknown) => v;

      class DualField {
        @Field("string")
        @Transform({ to, from })
        value!: string;
      }

      const meta = (DualField as any)[Symbol.metadata];
      expect(meta.fields).toHaveLength(1);
      expect(meta.fields[0].key).toBe("value");
      expect(meta.transforms).toHaveLength(1);
      expect(meta.transforms[0].key).toBe("value");
    });
  });
});
