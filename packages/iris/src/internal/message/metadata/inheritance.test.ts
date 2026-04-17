import { AbstractMessage } from "../../../decorators/AbstractMessage";
import { AfterConsume } from "../../../decorators/AfterConsume";
import { BeforePublish } from "../../../decorators/BeforePublish";
import { Field } from "../../../decorators/Field";
import { Generated } from "../../../decorators/Generated";
import { Header } from "../../../decorators/Header";
import { IdentifierField } from "../../../decorators/IdentifierField";
import { Message } from "../../../decorators/Message";
import { Namespace } from "../../../decorators/Namespace";
import { OnCreate } from "../../../decorators/OnCreate";
import { OnValidate } from "../../../decorators/OnValidate";
import { TimestampField } from "../../../decorators/TimestampField";
import { Transform } from "../../../decorators/Transform";
import { collectAll, collectOwn, collectSingular } from "./collect";

describe("inheritance with real decorators", () => {
  const parentOnCreate = (msg: any) => {
    msg.initialized = true;
  };
  const parentBeforePublish = (msg: any) => {
    msg.prepared = true;
  };
  const childOnValidate = (msg: any) => {
    if (!msg.name) throw new Error("name required");
  };
  const childAfterConsume = async (msg: any) => {
    msg.consumed = true;
  };

  const toUpper = (v: unknown) => String(v).toUpperCase();
  const fromUpper = (v: unknown) => String(v).toLowerCase();

  @AbstractMessage()
  @OnCreate(parentOnCreate)
  @BeforePublish(parentBeforePublish)
  class BaseEvent {
    @IdentifierField()
    id!: string;

    @TimestampField()
    createdAt!: Date;

    @Field("string")
    source!: string;

    @Header("x-trace-id")
    traceId!: string;

    @Generated("uuid")
    correlationId!: string;
  }

  @Namespace("users")
  @Message({ name: "UserCreatedEvent" })
  @OnValidate(childOnValidate)
  @AfterConsume(childAfterConsume)
  class UserCreatedEvent extends BaseEvent {
    @Field("string")
    name!: string;

    @Field("email")
    email!: string;

    @Header("x-user-id")
    userId!: string;

    @Generated("string", { length: 8 })
    shortCode!: string;

    @Transform({ to: toUpper, from: fromUpper })
    displayName!: string;
  }

  describe("collectAll for fields", () => {
    it("should merge fields from parent and child", () => {
      const fields = collectAll(UserCreatedEvent, "fields");

      const keys = fields.map((f: any) => f.key);
      expect(keys).toContain("id");
      expect(keys).toContain("createdAt");
      expect(keys).toContain("source");
      expect(keys).toContain("name");
      expect(keys).toContain("email");
      // displayName uses @Transform which stages as a transform, not a field
      expect(keys).not.toContain("displayName");
    });

    it("should contain correct number of fields from both levels", () => {
      const fields = collectAll(UserCreatedEvent, "fields");
      // Parent: id (IdentifierField), createdAt (TimestampField), source (Field)
      // Child: name (Field), email (Field)
      // displayName uses @Transform which stages in transforms, not fields
      // Total: 5 fields (traceId/userId are headers, not fields)
      expect(fields).toHaveLength(5);
    });

    it("should preserve decorator types from parent", () => {
      const fields = collectAll(UserCreatedEvent, "fields");
      const idField = fields.find((f: any) => f.key === "id");
      expect(idField?.decorator).toBe("IdentifierField");

      const tsField = fields.find((f: any) => f.key === "createdAt");
      expect(tsField?.decorator).toBe("TimestampField");
    });

    it("should snapshot all merged fields", () => {
      const fields = collectAll(UserCreatedEvent, "fields");

      // Replace dynamic defaults (uuid generator, Date generator) with stable placeholders
      const stable = fields.map((f: any) => ({
        ...f,
        default: typeof f.default === "function" ? "[function]" : f.default,
        transform: f.transform != null ? { to: "[function]", from: "[function]" } : null,
      }));

      expect(stable).toMatchSnapshot();
    });
  });

  describe("collectAll for transforms", () => {
    it("should collect transforms from child", () => {
      const transforms = collectAll(UserCreatedEvent, "transforms");
      const keys = transforms.map((t: any) => t.key);
      expect(keys).toContain("displayName");
    });

    it("should have correct count", () => {
      const transforms = collectAll(UserCreatedEvent, "transforms");
      expect(transforms).toHaveLength(1);
    });
  });

  describe("collectAll for hooks", () => {
    it("should merge hooks from parent and child", () => {
      const hooks = collectAll(UserCreatedEvent, "hooks");
      const decorators = hooks.map((h: any) => h.decorator);

      expect(decorators).toContain("OnCreate");
      expect(decorators).toContain("BeforePublish");
      expect(decorators).toContain("OnValidate");
      expect(decorators).toContain("AfterConsume");
    });

    it("should have correct total hook count", () => {
      const hooks = collectAll(UserCreatedEvent, "hooks");
      // Parent: OnCreate, BeforePublish
      // Child: OnValidate, AfterConsume
      expect(hooks).toHaveLength(4);
    });

    it("should preserve callback references", () => {
      const hooks = collectAll(UserCreatedEvent, "hooks");

      const onCreate = hooks.find((h: any) => h.decorator === "OnCreate");
      expect(onCreate?.callback).toBe(parentOnCreate);

      const onValidate = hooks.find((h: any) => h.decorator === "OnValidate");
      expect(onValidate?.callback).toBe(childOnValidate);
    });
  });

  describe("collectAll for headers", () => {
    it("should merge headers from parent and child", () => {
      const headers = collectAll(UserCreatedEvent, "headers");
      const keys = headers.map((h: any) => h.key);

      expect(keys).toContain("traceId");
      expect(keys).toContain("userId");
    });

    it("should have correct total header count", () => {
      const headers = collectAll(UserCreatedEvent, "headers");
      expect(headers).toHaveLength(2);
    });

    it("should snapshot merged headers", () => {
      const headers = collectAll(UserCreatedEvent, "headers");
      expect(headers).toMatchSnapshot();
    });
  });

  describe("collectAll for generated", () => {
    it("should merge generated from parent and child", () => {
      const generated = collectAll(UserCreatedEvent, "generated");
      const keys = generated.map((g: any) => g.key);

      expect(keys).toContain("correlationId");
      expect(keys).toContain("shortCode");
    });

    it("should have correct total generated count", () => {
      const generated = collectAll(UserCreatedEvent, "generated");
      expect(generated).toHaveLength(2);
    });

    it("should snapshot merged generated metadata", () => {
      const generated = collectAll(UserCreatedEvent, "generated");
      expect(generated).toMatchSnapshot();
    });
  });

  describe("collectSingular for message", () => {
    it("should find child Message metadata", () => {
      const message = collectSingular(UserCreatedEvent, "message");
      expect(message).toMatchSnapshot();
    });

    it("should have correct name", () => {
      const message = collectSingular(UserCreatedEvent, "message") as any;
      expect(message.name).toBe("UserCreatedEvent");
      expect(message.decorator).toBe("Message");
    });
  });

  describe("collectSingular for namespace", () => {
    it("should find namespace from @Namespace decorator", () => {
      const namespace = collectSingular(UserCreatedEvent, "namespace");
      expect(namespace).toBe("users");
    });
  });

  describe("collectOwn for __abstract", () => {
    it("should be true on parent", () => {
      expect(collectOwn(BaseEvent, "__abstract")).toBe(true);
    });

    it("should be undefined as own property on child", () => {
      expect(collectOwn(UserCreatedEvent, "__abstract")).toBeUndefined();
    });

    it("should be visible via collectSingular on child (inherited)", () => {
      const abstract = collectSingular(UserCreatedEvent, "__abstract");
      expect(abstract).toBe(true);
    });
  });

  describe("parent-only class has its own metadata", () => {
    it("should have fields only from parent", () => {
      const fields = collectAll(BaseEvent, "fields");
      const keys = fields.map((f: any) => f.key);

      expect(keys).toContain("id");
      expect(keys).toContain("createdAt");
      expect(keys).toContain("source");
      expect(keys).not.toContain("name");
      expect(keys).not.toContain("email");
    });

    it("should have hooks only from parent", () => {
      const hooks = collectAll(BaseEvent, "hooks");
      const decorators = hooks.map((h: any) => h.decorator);

      expect(decorators).toContain("OnCreate");
      expect(decorators).toContain("BeforePublish");
      expect(decorators).not.toContain("OnValidate");
      expect(decorators).not.toContain("AfterConsume");
    });
  });

  describe("three-level inheritance", () => {
    @AbstractMessage()
    @OnCreate(() => {})
    class GrandparentMsg {
      @IdentifierField()
      id!: string;
    }

    @AbstractMessage()
    @BeforePublish(() => {})
    class ParentMsg extends GrandparentMsg {
      @Field("string")
      name!: string;
    }

    @Message({ name: "GrandchildMsg" })
    @AfterConsume(async () => {})
    class GrandchildMsg extends ParentMsg {
      @Field("integer")
      age!: number;
    }

    it("should collect fields from all three levels", () => {
      const fields = collectAll(GrandchildMsg, "fields");
      const keys = fields.map((f: any) => f.key);

      expect(keys).toContain("id");
      expect(keys).toContain("name");
      expect(keys).toContain("age");
      expect(fields).toHaveLength(3);
    });

    it("should collect hooks from all three levels", () => {
      const hooks = collectAll(GrandchildMsg, "hooks");
      const decorators = hooks.map((h: any) => h.decorator);

      expect(decorators).toContain("OnCreate");
      expect(decorators).toContain("BeforePublish");
      expect(decorators).toContain("AfterConsume");
      expect(hooks).toHaveLength(3);
    });

    it("should find Message only on grandchild via collectSingular", () => {
      const message = collectSingular(GrandchildMsg, "message") as any;
      expect(message.name).toBe("GrandchildMsg");
      expect(message.decorator).toBe("Message");
    });

    it("should find __abstract on parent and grandparent only", () => {
      expect(collectOwn(GrandparentMsg, "__abstract")).toBe(true);
      expect(collectOwn(ParentMsg, "__abstract")).toBe(true);
      expect(collectOwn(GrandchildMsg, "__abstract")).toBeUndefined();
    });

    it("should snapshot the full field chain", () => {
      const fields = collectAll(GrandchildMsg, "fields");
      const stable = fields.map((f: any) => ({
        ...f,
        default: typeof f.default === "function" ? "[function]" : f.default,
      }));
      expect(stable).toMatchSnapshot();
    });
  });

  describe("sibling classes sharing a parent", () => {
    @AbstractMessage()
    class SharedBase {
      @Field("string")
      baseField!: string;
    }

    @Message({ name: "SiblingA" })
    class SiblingA extends SharedBase {
      @Field("integer")
      aField!: number;
    }

    @Message({ name: "SiblingB" })
    class SiblingB extends SharedBase {
      @Field("boolean")
      bField!: boolean;
    }

    it("should not leak SiblingA fields into SiblingB", () => {
      const aFields = collectAll(SiblingA, "fields");
      const bFields = collectAll(SiblingB, "fields");

      const aKeys = aFields.map((f: any) => f.key);
      const bKeys = bFields.map((f: any) => f.key);

      expect(aKeys).toContain("baseField");
      expect(aKeys).toContain("aField");
      expect(aKeys).not.toContain("bField");

      expect(bKeys).toContain("baseField");
      expect(bKeys).toContain("bField");
      expect(bKeys).not.toContain("aField");
    });

    it("should have independent message metadata", () => {
      const aMsg = collectSingular(SiblingA, "message") as any;
      const bMsg = collectSingular(SiblingB, "message") as any;

      expect(aMsg.name).toBe("SiblingA");
      expect(bMsg.name).toBe("SiblingB");
    });
  });
});
