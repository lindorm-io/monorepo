import { AbstractMessage } from "../../../decorators/AbstractMessage.js";
import { AfterConsume } from "../../../decorators/AfterConsume.js";
import { BeforePublish } from "../../../decorators/BeforePublish.js";
import { Broadcast } from "../../../decorators/Broadcast.js";
import { Encrypted } from "../../../decorators/Encrypted.js";
import { Field } from "../../../decorators/Field.js";
import { Generated } from "../../../decorators/Generated.js";
import { Header } from "../../../decorators/Header.js";
import { IdentifierField } from "../../../decorators/IdentifierField.js";
import { Message } from "../../../decorators/Message.js";
import { Namespace } from "../../../decorators/Namespace.js";
import { OnCreate } from "../../../decorators/OnCreate.js";
import { Optional } from "../../../decorators/Optional.js";
import { OnValidate } from "../../../decorators/OnValidate.js";
import { TimestampField } from "../../../decorators/TimestampField.js";
import { Transform } from "../../../decorators/Transform.js";
import { Version } from "../../../decorators/Version.js";
import { buildMessageMetadata } from "./build-message-metadata.js";
import { describe, expect, it } from "vitest";

const stabilize = (metadata: any) => ({
  ...metadata,
  target: metadata.target?.name ?? metadata.target,
  fields: metadata.fields?.map((f: any) => ({
    ...f,
    default: typeof f.default === "function" ? "[function]" : f.default,
    transform: f.transform != null ? { to: "[function]", from: "[function]" } : null,
  })),
  hooks: metadata.hooks?.map((h: any) => ({
    ...h,
    callback: "[function]",
  })),
  topic: metadata.topic != null ? { callback: "[function]" } : null,
  encrypted:
    metadata.encrypted != null ? { predicate: metadata.encrypted.predicate } : null,
});

describe("buildMessageMetadata", () => {
  describe("guards", () => {
    it("should throw for abstract-only class without @Message", () => {
      @AbstractMessage()
      class AbstractOnly {
        @Field("string")
        name!: string;
      }

      expect(() => buildMessageMetadata(AbstractOnly)).toThrow(
        "Cannot build metadata for abstract message without @Message on concrete subclass",
      );
    });

    it("should throw when @AbstractMessage and @Message are on the same class (AbstractMessage on top)", () => {
      expect(() => {
        @AbstractMessage()
        @Message({ name: "Conflict" })
        class ConflictMsg {
          @Field("string")
          name!: string;
        }
        void ConflictMsg;
      }).toThrow("Cannot combine @AbstractMessage and @Message on the same class");
    });

    it("should throw when @AbstractMessage and @Message are on the same class (Message on top)", () => {
      expect(() => {
        @Message({ name: "Conflict2" })
        @AbstractMessage()
        class ConflictMsg2 {
          @Field("string")
          name!: string;
        }
        void ConflictMsg2;
      }).toThrow("Cannot combine @AbstractMessage and @Message on the same class");
    });

    it("should throw when no message metadata exists", () => {
      class NoDecorators {
        name!: string;
      }

      expect(() => buildMessageMetadata(NoDecorators)).toThrow(
        "Message metadata not found",
      );
    });

    it("should throw when concrete class extends another concrete class", () => {
      @Message({ name: "ParentConcrete" })
      class ParentConcrete {
        @Field("string")
        name!: string;
      }

      @Message({ name: "ChildConcrete" })
      class ChildConcrete extends ParentConcrete {
        @Field("integer")
        age!: number;
      }

      expect(() => buildMessageMetadata(ChildConcrete)).toThrow(
        "@Message class cannot extend another @Message class",
      );
    });

    it("should throw when concrete class extends another concrete class through an undecorated intermediate", () => {
      @Message({ name: "GrandparentConcrete" })
      class GrandparentConcrete {
        @Field("string")
        name!: string;
      }

      class MiddleClass extends GrandparentConcrete {
        @Field("integer")
        age!: number;
      }

      @Message({ name: "GrandchildConcrete" })
      class GrandchildConcrete extends MiddleClass {
        @Field("string")
        email!: string;
      }

      expect(() => buildMessageMetadata(GrandchildConcrete)).toThrow(
        "@Message class cannot extend another @Message class",
      );
    });
  });

  describe("single class with mixed decorators", () => {
    const onCreate = (msg: any) => {
      msg.init = true;
    };

    @Namespace("test")
    @Message({ name: "SimpleEvent" })
    @OnCreate(onCreate)
    class SimpleEvent {
      @IdentifierField()
      id!: string;

      @TimestampField()
      createdAt!: Date;

      @Field("string")
      name!: string;

      @Optional()
      @Field("email")
      email!: string;

      @Header("x-trace-id")
      @Field("string")
      traceId!: string;

      @Field("uuid")
      @Generated("uuid")
      correlationId!: string;
    }

    it("should resolve metadata", () => {
      const metadata = buildMessageMetadata(SimpleEvent);
      expect(stabilize(metadata)).toMatchSnapshot();
    });
  });

  describe("abstract + concrete hierarchy", () => {
    const parentHook = () => {};
    const childHook = () => {};

    @AbstractMessage()
    @Encrypted()
    @OnCreate(parentHook)
    class BaseMsg {
      @IdentifierField()
      id!: string;

      @Field("string")
      source!: string;
    }

    @Namespace("derived")
    @Message({ name: "DerivedMsg" })
    @OnValidate(childHook)
    class DerivedMsg extends BaseMsg {
      @Field("string")
      payload!: string;
    }

    it("should inherit fields and hooks from parent", () => {
      const metadata = buildMessageMetadata(DerivedMsg);
      expect(stabilize(metadata)).toMatchSnapshot();
    });

    it("should inherit encrypted singleton from parent", () => {
      const metadata = buildMessageMetadata(DerivedMsg);
      expect(metadata.encrypted).not.toBeNull();
    });

    it("should use child message metadata", () => {
      const metadata = buildMessageMetadata(DerivedMsg);
      expect(metadata.message.name).toBe("DerivedMsg");
      expect(metadata.message.decorator).toBe("Message");
    });

    it("should use namespace from @Namespace decorator", () => {
      const metadata = buildMessageMetadata(DerivedMsg);
      expect(metadata.namespace).toBe("derived");
    });
  });

  describe("multi-level hierarchy", () => {
    @AbstractMessage()
    @Broadcast()
    class GrandparentMsg {
      @IdentifierField()
      id!: string;
    }

    @AbstractMessage()
    class ParentMsg extends GrandparentMsg {
      @Field("string")
      name!: string;
    }

    @Message({ name: "GrandchildMsg" })
    class GrandchildMsg extends ParentMsg {
      @Field("integer")
      age!: number;
    }

    it("should merge metadata from all three levels", () => {
      const metadata = buildMessageMetadata(GrandchildMsg);
      expect(stabilize(metadata)).toMatchSnapshot();
    });

    it("should inherit broadcast from grandparent", () => {
      const metadata = buildMessageMetadata(GrandchildMsg);
      expect(metadata.broadcast).toBe(true);
    });

    it("should have fields from all levels", () => {
      const metadata = buildMessageMetadata(GrandchildMsg);
      const keys = metadata.fields.map((f) => f.key);
      expect(keys).toContain("id");
      expect(keys).toContain("name");
      expect(keys).toContain("age");
    });

    it("should default namespace to null when not set", () => {
      const metadata = buildMessageMetadata(GrandchildMsg);
      expect(metadata.namespace).toBeNull();
    });
  });

  describe("version decorator", () => {
    it("should collect version from @Version", () => {
      @Version(3)
      @Message({ name: "VersionedMsg" })
      class VersionedMsg {
        @Field("string")
        data!: string;
      }

      const metadata = buildMessageMetadata(VersionedMsg);
      expect(metadata.version).toBe(3);
    });

    it("should default version to 1 when not set", () => {
      @Message({ name: "UnversionedMsg" })
      class UnversionedMsg {
        @Field("string")
        data!: string;
      }

      const metadata = buildMessageMetadata(UnversionedMsg);
      expect(metadata.version).toBe(1);
    });

    it("should extract version from class name suffix _vN", () => {
      @Message()
      class OrderCreated_v2 {
        @Field("string")
        data!: string;
      }

      const metadata = buildMessageMetadata(OrderCreated_v2);
      expect(metadata.version).toBe(2);
      expect(metadata.message.name).toBe("OrderCreated");
    });

    it("should extract version from class name suffix _VN", () => {
      @Message()
      class OrderCreated_V5 {
        @Field("string")
        data!: string;
      }

      const metadata = buildMessageMetadata(OrderCreated_V5);
      expect(metadata.version).toBe(5);
      expect(metadata.message.name).toBe("OrderCreated");
    });

    it("should prefer explicit @Version over class name suffix", () => {
      @Version(10)
      @Message()
      class OrderCreated_v2 {
        @Field("string")
        data!: string;
      }

      const metadata = buildMessageMetadata(OrderCreated_v2);
      expect(metadata.version).toBe(10);
      expect(metadata.message.name).toBe("OrderCreated");
    });

    it("should strip version suffix from custom name too", () => {
      @Message({ name: "MyEvent_v3" })
      class SomeClass {
        @Field("string")
        data!: string;
      }

      const metadata = buildMessageMetadata(SomeClass);
      expect(metadata.message.name).toBe("MyEvent");
      expect(metadata.version).toBe(1); // no suffix on class name, no @Version
    });
  });

  describe("transform merging", () => {
    it("should merge @Transform into matching field", () => {
      const toUpper = (v: unknown) => String(v).toUpperCase();
      const fromUpper = (v: unknown) => String(v).toLowerCase();

      @Message({ name: "TransformMsg" })
      class TransformMsg {
        @Field("string")
        @Transform({ to: toUpper, from: fromUpper })
        name!: string;
      }

      const metadata = buildMessageMetadata(TransformMsg);
      const nameField = metadata.fields.find((f) => f.key === "name");
      expect(nameField?.transform).not.toBeNull();
      expect(nameField?.transform?.to).toBe(toUpper);
      expect(nameField?.transform?.from).toBe(fromUpper);
    });

    it("should throw when @Transform has no matching @Field", () => {
      @Message({ name: "BadTransformMsg" })
      class BadTransformMsg {
        @Transform({ to: (v) => v, from: (v) => v })
        orphan!: string;
      }

      expect(() => buildMessageMetadata(BadTransformMsg)).toThrow(
        '@Transform on property "orphan" requires a @Field decorator',
      );
    });

    it("should inherit @Transform from abstract parent", () => {
      const toUpper = (v: unknown) => String(v).toUpperCase();
      const fromUpper = (v: unknown) => String(v).toLowerCase();

      @AbstractMessage()
      class TransformBase {
        @Field("string")
        @Transform({ to: toUpper, from: fromUpper })
        name!: string;
      }

      @Message({ name: "TransformChild" })
      class TransformChild extends TransformBase {
        @Field("string")
        extra!: string;
      }

      const metadata = buildMessageMetadata(TransformChild);
      const nameField = metadata.fields.find((f) => f.key === "name");
      expect(nameField?.transform).not.toBeNull();
      expect(nameField?.transform?.to).toBe(toUpper);
      expect(nameField?.transform?.from).toBe(fromUpper);
    });

    it("should throw on duplicate @Transform for the same key", () => {
      @AbstractMessage()
      class DupTransformBase {
        @Field("string")
        @Transform({ to: (v) => v, from: (v) => v })
        name!: string;
      }

      @Message({ name: "DupTransformChild" })
      class DupTransformChild extends DupTransformBase {
        @Field("string")
        @Transform({ to: (v) => v, from: (v) => v })
        name: string = undefined as any;
      }

      expect(() => buildMessageMetadata(DupTransformChild)).toThrow(
        "Duplicate @Transform",
      );
    });
  });

  describe("singleton inheritance", () => {
    @AbstractMessage()
    @Encrypted({ algorithm: "A256GCM" } as any)
    class EncryptedBase {
      @Field("string")
      data!: string;
    }

    @Message({ name: "EncryptedChild" })
    class EncryptedChild extends EncryptedBase {
      @Field("string")
      extra!: string;
    }

    it("should inherit encrypted from abstract parent", () => {
      const metadata = buildMessageMetadata(EncryptedChild);
      expect(metadata.encrypted).not.toBeNull();
    });
  });
});
