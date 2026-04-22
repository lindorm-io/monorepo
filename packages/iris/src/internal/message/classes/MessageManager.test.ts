import { AbstractMessage } from "../../../decorators/AbstractMessage.js";
import { Default } from "../../../decorators/Default.js";
import { Enum } from "../../../decorators/Enum.js";
import { Field } from "../../../decorators/Field.js";
import { Generated } from "../../../decorators/Generated.js";
import { IdentifierField } from "../../../decorators/IdentifierField.js";
import { Max } from "../../../decorators/Max.js";
import { Message } from "../../../decorators/Message.js";
import { Min } from "../../../decorators/Min.js";
import { Namespace } from "../../../decorators/Namespace.js";
import { Nullable } from "../../../decorators/Nullable.js";
import { OnCreate } from "../../../decorators/OnCreate.js";
import { OnHydrate } from "../../../decorators/OnHydrate.js";
import { OnValidate } from "../../../decorators/OnValidate.js";
import { Schema } from "../../../decorators/Schema.js";
import { TimestampField } from "../../../decorators/TimestampField.js";
import { Transform } from "../../../decorators/Transform.js";
import { IrisError } from "../../../errors/IrisError.js";
import { MessageManager } from "./MessageManager.js";
import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

@Namespace("test")
@Message({ name: "TestEvent" })
class TestEvent {
  @IdentifierField()
  id!: string;

  @TimestampField()
  timestamp!: Date;

  @Field("string")
  name!: string;

  @Default(0)
  @Field("integer")
  count!: number;
}

@Namespace("test")
@Message({ name: "NullableEvent" })
class NullableEvent {
  @IdentifierField()
  id!: string;

  @Nullable()
  @Field("string")
  label!: string | null;

  @Nullable()
  @Field("integer")
  score!: number | null;
}

@Namespace("test")
@Message({ name: "GeneratedEvent" })
class GeneratedEvent {
  @IdentifierField()
  id!: string;

  @Generated("uuid")
  @Field("uuid")
  traceId!: string;

  @Generated("date")
  @Field("date")
  createdAt!: Date;

  @Generated("string", { length: 16 })
  @Field("string")
  token!: string;

  @Generated("integer", { min: 1, max: 100 })
  @Field("integer")
  sequence!: number;

  @Generated("float", { min: 0, max: 1 })
  @Field("float")
  weight!: number;
}

const onCreateSpy = vi.fn();
const onHydrateSpy = vi.fn();
const onValidateSpy = vi.fn();

@OnValidate(onValidateSpy)
@OnHydrate(onHydrateSpy)
@OnCreate(onCreateSpy)
@Namespace("test")
@Message({ name: "HookedEvent" })
class HookedEvent {
  @IdentifierField()
  id!: string;

  @Field("string")
  name!: string;
}

@Namespace("test")
@Message({ name: "TransformEvent" })
class TransformEvent {
  @IdentifierField()
  id!: string;

  @Transform({
    to: (val: unknown) => (val as string).toUpperCase(),
    from: (raw: unknown) => (raw as string).toLowerCase(),
  })
  @Field("string")
  code!: string;
}

@Namespace("test")
@Message({ name: "SchemaEvent" })
class SchemaEvent {
  @IdentifierField()
  id!: string;

  @Schema(z.string().min(1))
  @Field("string")
  name!: string;
}

@Namespace("test")
@Message({ name: "MinMaxEvent" })
class MinMaxEvent {
  @IdentifierField()
  id!: string;

  @Min(0)
  @Max(100)
  @Field("integer")
  score!: number;

  @Min(1)
  @Max(10)
  @Field("string")
  label!: string;
}

@AbstractMessage()
class BaseEvent {
  @IdentifierField()
  id!: string;

  @TimestampField()
  timestamp!: Date;
}

@Namespace("test")
@Message({ name: "ChildEvent" })
class ChildEvent extends BaseEvent {
  @Field("string")
  childName!: string;

  @Default(0)
  @Field("integer")
  childCount!: number;
}

@Namespace("test")
@Message({ name: "EnumEvent" })
class EnumEvent {
  @IdentifierField()
  id!: string;

  @Enum({ A: "a", B: "b", C: "c" })
  @Field("enum")
  status!: string;
}

@Namespace("test")
@Message({ name: "ComplexEvent" })
class ComplexEvent {
  @IdentifierField()
  id!: string;

  @Field("array")
  tags!: Array<any>;

  @Field("object")
  metadata!: Record<string, any>;

  @Default(false)
  @Field("boolean")
  active!: boolean;
}

@Namespace("test")
@Message({ name: "NullableDefaultEvent" })
class NullableDefaultEvent {
  @IdentifierField()
  id!: string;

  @Nullable()
  @Default("fallback")
  @Field("string")
  label!: string | null;

  @Nullable()
  @Field("boolean")
  flag!: boolean | null;
}

// --- Stabilize helpers ---

const stabilizeMessage = (msg: any, keys: Array<string>) => {
  const result: Record<string, any> = {};
  for (const key of keys) {
    const val = msg[key];
    if (val instanceof Date) {
      result[key] = "[Date]";
    } else if (typeof val === "string" && /^[0-9a-f-]{36}$/.test(val)) {
      result[key] = "[uuid]";
    } else {
      result[key] = val;
    }
  }
  return result;
};

// --- Tests ---

describe("MessageManager", () => {
  describe("constructor", () => {
    it("should construct with valid target", () => {
      const manager = new MessageManager({ target: TestEvent });
      expect(manager.target).toBe(TestEvent);
      expect(manager.metadata).toBeDefined();
      expect(manager.metadata.message.name).toBe("TestEvent");
    });

    it("should throw when target is missing", () => {
      expect(() => new MessageManager({ target: undefined as any })).toThrow(IrisError);
    });

    it("should throw when target has no @Message decorator", () => {
      class PlainClass {
        id!: string;
      }
      expect(() => new MessageManager({ target: PlainClass as any })).toThrow(
        /Did you forget @Message/,
      );
    });
  });

  describe("create()", () => {
    it("should create an instance of the target class", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.create({ name: "hello" });

      expect(msg).toBeInstanceOf(TestEvent);
    });

    it("should apply field defaults", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.create({ name: "hello" });

      expect(msg.count).toBe(0);
    });

    it("should generate @IdentifierField (uuid) and @TimestampField (date)", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.create({ name: "test" });

      expect(msg.id).toEqual(expect.any(String));
      expect(msg.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(msg.timestamp).toEqual(expect.any(Date));
    });

    it("should allow user-provided values to override defaults and generation", () => {
      const manager = new MessageManager({ target: TestEvent });
      const customId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
      const customDate = new Date("2020-01-01T00:00:00Z");
      const msg = manager.create({
        id: customId,
        timestamp: customDate,
        name: "custom",
        count: 42,
      });

      expect(msg.id).toBe(customId);
      expect(msg.timestamp).toEqual(customDate);
      expect(msg.name).toBe("custom");
      expect(msg.count).toBe(42);
    });

    it("should return a typed instance with all fields populated", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.create({ name: "hello" });

      expect(
        stabilizeMessage(msg, ["id", "timestamp", "name", "count"]),
      ).toMatchSnapshot();
    });

    it("should handle nullable fields", () => {
      const manager = new MessageManager({ target: NullableEvent });
      const msg = manager.create();

      expect(msg.label).toBeNull();
      expect(msg.score).toBeNull();
    });

    it("should handle nullable fields with provided values", () => {
      const manager = new MessageManager({ target: NullableEvent });
      const msg = manager.create({ label: "test", score: 42 });

      expect(msg.label).toBe("test");
      expect(msg.score).toBe(42);
    });

    it("should handle complex field types", () => {
      const manager = new MessageManager({ target: ComplexEvent });
      const msg = manager.create({
        tags: ["a", "b"],
        metadata: { key: "value" },
      });

      expect(msg.tags).toEqual(["a", "b"]);
      expect(msg.metadata).toEqual({ key: "value" });
      expect(msg.active).toBe(false);
    });
  });

  describe("create() with @Generated fields", () => {
    it("should generate uuid strategy", () => {
      const manager = new MessageManager({ target: GeneratedEvent });
      const msg = manager.create();

      expect(msg.traceId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("should generate date strategy", () => {
      const manager = new MessageManager({ target: GeneratedEvent });
      const msg = manager.create();

      expect(msg.createdAt).toEqual(expect.any(Date));
    });

    it("should generate string strategy with length", () => {
      const manager = new MessageManager({ target: GeneratedEvent });
      const msg = manager.create();

      expect(msg.token).toEqual(expect.any(String));
      expect(msg.token.length).toBeGreaterThan(0);
    });

    it("should generate integer strategy within range", () => {
      const manager = new MessageManager({ target: GeneratedEvent });
      const msg = manager.create();

      expect(msg.sequence).toEqual(expect.any(Number));
      expect(Number.isInteger(msg.sequence)).toBe(true);
      expect(msg.sequence).toBeGreaterThanOrEqual(1);
      expect(msg.sequence).toBeLessThan(100);
    });

    it("should generate float strategy within range", () => {
      const manager = new MessageManager({ target: GeneratedEvent });
      const msg = manager.create();

      expect(msg.weight).toEqual(expect.any(Number));
      expect(msg.weight).toBeGreaterThanOrEqual(0);
      expect(msg.weight).toBeLessThan(1);
    });

    it("should not overwrite user-provided generated field values", () => {
      const manager = new MessageManager({ target: GeneratedEvent });
      const customId = "11111111-2222-3333-4444-555555555555";
      const msg = manager.create({ traceId: customId });

      expect(msg.traceId).toBe(customId);
    });
  });

  describe("hydrate()", () => {
    it("should reconstruct from raw data", () => {
      const manager = new MessageManager({ target: TestEvent });
      const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
      const now = new Date();
      const msg = manager.hydrate({
        id,
        timestamp: now.toISOString(),
        name: "restored",
        count: 7,
      });

      expect(msg).toBeInstanceOf(TestEvent);
      expect(msg.id).toBe(id);
      expect(msg.timestamp).toEqual(now);
      expect(msg.name).toBe("restored");
      expect(msg.count).toBe(7);
    });

    it("should deserialise string date to Date", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        timestamp: "2023-06-15T12:00:00.000Z",
        name: "test",
        count: 1,
      });

      expect(msg.timestamp).toBeInstanceOf(Date);
      expect(msg.timestamp.toISOString()).toBe("2023-06-15T12:00:00.000Z");
    });

    it("should deserialise string integer to number", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        timestamp: new Date(),
        name: "test",
        count: "42",
      });

      expect(msg.count).toBe(42);
    });

    it("should apply @Transform.from", () => {
      const manager = new MessageManager({ target: TransformEvent });
      const msg = manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        code: "HELLO_WORLD",
      });

      expect(msg.code).toBe("hello_world");
    });

    it("should NOT generate new values", () => {
      const manager = new MessageManager({ target: GeneratedEvent });
      const msg = manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        traceId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
        createdAt: "2023-01-01T00:00:00Z",
        token: "my-token",
        sequence: 5,
        weight: 0.5,
      });

      expect(msg.traceId).toBe("bbbbbbbb-cccc-dddd-eeee-ffffffffffff");
      expect(msg.sequence).toBe(5);
    });

    it("should use defaults for missing non-nullable fields", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        timestamp: new Date(),
      });

      // count has default 0, name has no default
      expect(msg.count).toBe(0);
    });

    it("should set missing nullable fields to null", () => {
      const manager = new MessageManager({ target: NullableEvent });
      const msg = manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      });

      expect(msg.label).toBeNull();
      expect(msg.score).toBeNull();
    });
  });

  describe("copy()", () => {
    it("should deep copy all field values from source", () => {
      const manager = new MessageManager({ target: TestEvent });
      const original = manager.create({ name: "original", count: 10 });
      const copy = manager.copy(original);

      expect(copy).toBeInstanceOf(TestEvent);
      expect(copy.name).toBe("original");
      expect(copy.count).toBe(10);
    });

    it("should produce fresh identity (different id and timestamp)", () => {
      const manager = new MessageManager({ target: TestEvent });
      const original = manager.create({ name: "original" });
      const copy = manager.copy(original);

      expect(copy.id).toEqual(expect.any(String));
      expect(copy.id).not.toBe(original.id);
      expect(copy.timestamp).toEqual(expect.any(Date));
      expect(copy.timestamp).not.toBe(original.timestamp);
    });

    it("should produce fresh @Generated field values", () => {
      const manager = new MessageManager({ target: GeneratedEvent });
      const original = manager.create();
      const copy = manager.copy(original);

      expect(copy.id).not.toBe(original.id);
      expect(copy.traceId).not.toBe(original.traceId);
      expect(copy.createdAt).not.toBe(original.createdAt);
      expect(copy.token).not.toBe(original.token);
    });

    it("should produce independent instances", () => {
      const manager = new MessageManager({ target: ComplexEvent });
      const original = manager.create({
        tags: ["a"],
        metadata: { key: "value" },
      });
      const copy = manager.copy(original);

      copy.tags.push("b");
      expect(original.tags).not.toContain("b");
    });
  });

  describe("validate()", () => {
    it("should pass for a valid message", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.create({ name: "valid" });

      expect(() => manager.validate(msg)).not.toThrow();
    });

    it("should throw for wrong field type", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.create({ name: "test" });
      (msg as any).count = "not-a-number";

      expect(() => manager.validate(msg)).toThrow();
    });

    it("should apply @Schema validator", () => {
      const manager = new MessageManager({ target: SchemaEvent });
      const msg = manager.create({ name: "" });

      expect(() => manager.validate(msg)).toThrow();
    });

    it("should pass @Schema validator for valid data", () => {
      const manager = new MessageManager({ target: SchemaEvent });
      const msg = manager.create({ name: "valid" });

      expect(() => manager.validate(msg)).not.toThrow();
    });

    it("should enforce min/max constraints", () => {
      const manager = new MessageManager({ target: MinMaxEvent });
      const msg = manager.create({ score: 200, label: "valid" });

      expect(() => manager.validate(msg)).toThrow();
    });

    it("should enforce min string length", () => {
      const manager = new MessageManager({ target: MinMaxEvent });
      const msg = manager.create({ score: 50, label: "" });

      expect(() => manager.validate(msg)).toThrow();
    });

    it("should validate enum values", () => {
      const manager = new MessageManager({ target: EnumEvent });
      const msg = manager.create({ status: "a" });

      expect(() => manager.validate(msg)).not.toThrow();
    });

    it("should reject invalid enum values", () => {
      const manager = new MessageManager({ target: EnumEvent });
      const msg = manager.create({ status: "invalid" });

      expect(() => manager.validate(msg)).toThrow();
    });

    it("should cache schema on second call", () => {
      const manager = new MessageManager({ target: TestEvent });
      const msg = manager.create({ name: "test" });

      manager.validate(msg);
      const cachedSchema = (manager as any)._schemaCache;
      manager.validate(msg);

      expect((manager as any)._schemaCache).toBe(cachedSchema);
    });
  });

  describe("hooks", () => {
    beforeEach(() => {
      onCreateSpy.mockReset();
      onHydrateSpy.mockReset();
      onValidateSpy.mockReset();
    });

    it("should fire @OnCreate hook during create()", () => {
      const meta = {
        correlationId: "corr-abc",
        actor: "abc",
        timestamp: new Date("2020-01-01T00:00:00Z"),
      };
      const manager = new MessageManager({
        target: HookedEvent,
        meta,
      });
      const msg = manager.create({ name: "test" });

      expect(onCreateSpy).toHaveBeenCalledTimes(1);
      expect(onCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test" }),
        meta,
      );
      expect(onCreateSpy.mock.calls[0][0]).toBe(msg);
    });

    it("should fire @OnHydrate hook during hydrate()", () => {
      const meta = {
        correlationId: "corr-abc",
        actor: "abc",
        timestamp: new Date("2020-01-01T00:00:00Z"),
      };
      const manager = new MessageManager({
        target: HookedEvent,
        meta,
      });
      manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        name: "restored",
      });

      expect(onHydrateSpy).toHaveBeenCalledTimes(1);
      expect(onHydrateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: "restored" }),
        meta,
      );
    });

    it("should NOT fire @OnCreate during hydrate()", () => {
      const manager = new MessageManager({ target: HookedEvent });
      manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        name: "test",
      });

      expect(onCreateSpy).not.toHaveBeenCalled();
    });

    it("should fire @OnValidate hook during validate()", () => {
      const meta = {
        correlationId: "corr-abc",
        actor: "abc",
        timestamp: new Date("2020-01-01T00:00:00Z"),
      };
      const manager = new MessageManager({
        target: HookedEvent,
        meta,
      });
      const msg = manager.create({ name: "test" });
      onCreateSpy.mockReset();

      manager.validate(msg);

      expect(onValidateSpy).toHaveBeenCalledTimes(1);
      expect(onValidateSpy).toHaveBeenCalledWith(msg, meta);
    });

    it("should fire @OnCreate hook during copy()", () => {
      const manager = new MessageManager({ target: HookedEvent });
      const original = manager.create({ name: "source" });
      onCreateSpy.mockReset();

      manager.copy(original);

      expect(onCreateSpy).toHaveBeenCalledTimes(1);
    });

    it("should throw when sync hook returns a Promise", () => {
      const asyncCallback = vi.fn().mockResolvedValue(undefined);

      @OnCreate(asyncCallback)
      @Namespace("test")
      @Message({ name: "AsyncHookEvent" })
      class AsyncHookEvent {
        @IdentifierField()
        id!: string;

        @Field("string")
        name!: string;
      }

      const manager = new MessageManager({ target: AsyncHookEvent });

      expect(() => manager.create({ name: "test" })).toThrow(/hooks must be synchronous/);
    });

    // Decorators execute bottom-up (closest to the class first), so the metadata
    // collection order is child-first. Hooks fire in that same collection order.
    it("should fire hooks in metadata collection order (child-first)", () => {
      const order: Array<string> = [];
      const first = vi.fn(() => {
        order.push("first");
      });
      const second = vi.fn(() => {
        order.push("second");
      });

      @OnCreate(second)
      @OnCreate(first)
      @Namespace("test")
      @Message({ name: "OrderedHookEvent" })
      class OrderedHookEvent {
        @IdentifierField()
        id!: string;
      }

      const manager = new MessageManager({ target: OrderedHookEvent });
      manager.create();

      expect(order).toEqual(["first", "second"]);
    });

    it("should fire child hooks before parent hooks in inheritance", () => {
      const order: Array<string> = [];
      const parentSpy = vi.fn(() => {
        order.push("parent");
      });
      const childSpy = vi.fn(() => {
        order.push("child");
      });

      @OnCreate(parentSpy)
      @AbstractMessage()
      class ParentMsg {
        @IdentifierField()
        id!: string;
      }

      @OnCreate(childSpy)
      @Namespace("test")
      @Message({ name: "ChildMsg" })
      class ChildMsg extends ParentMsg {
        @Default("x")
        @Field("string")
        value!: string;
      }

      const manager = new MessageManager({ target: ChildMsg });
      manager.create();

      // Child-first: child hook fires before parent hook
      expect(order).toEqual(["child", "parent"]);
    });
  });

  describe("async hooks", () => {
    it("should fire beforePublish", async () => {
      const spy = vi.fn();

      const { BeforePublish } = await import("../../../decorators/BeforePublish.js");

      @BeforePublish(spy)
      @Namespace("test")
      @Message({ name: "PubHookEvent" })
      class PubHookEvent {
        @IdentifierField()
        id!: string;
      }

      const manager = new MessageManager({ target: PubHookEvent });
      const msg = manager.create();
      await manager.beforePublish(msg);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        msg,
        expect.objectContaining({
          correlationId: "unknown",
          actor: null,
          timestamp: expect.any(Date),
        }),
      );
    });

    it("should fire afterConsume", async () => {
      const spy = vi.fn();

      const { AfterConsume } = await import("../../../decorators/AfterConsume.js");

      @AfterConsume(spy)
      @Namespace("test")
      @Message({ name: "ConsumeHookEvent" })
      class ConsumeHookEvent {
        @IdentifierField()
        id!: string;
      }

      const manager = new MessageManager({ target: ConsumeHookEvent });
      const msg = manager.create();
      await manager.afterConsume(msg);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("inheritance", () => {
    it("should inherit parent fields", () => {
      const manager = new MessageManager({ target: ChildEvent });
      const msg = manager.create({ childName: "child", childCount: 5 });

      expect(msg).toBeInstanceOf(ChildEvent);
      expect(msg.id).toEqual(expect.any(String));
      expect(msg.timestamp).toEqual(expect.any(Date));
      expect(msg.childName).toBe("child");
      expect(msg.childCount).toBe(5);
    });

    it("should hydrate inherited fields", () => {
      const manager = new MessageManager({ target: ChildEvent });
      const msg = manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        timestamp: "2023-06-15T12:00:00.000Z",
        childName: "restored",
        childCount: 3,
      });

      expect(msg.id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
      expect(msg.timestamp).toBeInstanceOf(Date);
      expect(msg.childName).toBe("restored");
      expect(msg.childCount).toBe(3);
    });

    it("should validate inherited fields", () => {
      const manager = new MessageManager({ target: ChildEvent });
      const msg = manager.create({ childName: "valid" });

      expect(() => manager.validate(msg)).not.toThrow();
    });

    it("should validate child-specific field constraints", () => {
      const manager = new MessageManager({ target: ChildEvent });
      const msg = manager.create({ childName: "test" });
      (msg as any).childCount = "not-a-number";

      expect(() => manager.validate(msg)).toThrow();
    });
  });

  describe("nullable fields with defaults", () => {
    it("should use default when value is not provided", () => {
      const manager = new MessageManager({ target: NullableDefaultEvent });
      const msg = manager.create();

      expect(msg.label).toBe("fallback");
    });

    it("should respect explicit null on a nullable field with default", () => {
      const manager = new MessageManager({ target: NullableDefaultEvent });
      const msg = manager.create({ label: null } as any);

      expect(msg.label).toBeNull();
    });
  });

  describe("hydrate() with null boolean", () => {
    it("should preserve null for a nullable boolean field", () => {
      const manager = new MessageManager({ target: NullableDefaultEvent });
      const msg = manager.hydrate({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        flag: null,
      });

      expect(msg.flag).toBeNull();
    });
  });

  describe("validate() with nullable fields", () => {
    it("should pass when nullable fields are null", () => {
      const manager = new MessageManager({ target: NullableEvent });
      const msg = manager.create();

      expect(msg.label).toBeNull();
      expect(msg.score).toBeNull();
      expect(() => manager.validate(msg)).not.toThrow();
    });
  });

  describe("async hook error propagation", () => {
    it("should propagate errors from async hooks", async () => {
      const { BeforePublish } = await import("../../../decorators/BeforePublish.js");

      @BeforePublish(() => {
        throw new Error("hook failed");
      })
      @Namespace("test")
      @Message({ name: "AsyncErrorEvent" })
      class AsyncErrorEvent {
        @IdentifierField()
        id!: string;
      }

      const manager = new MessageManager({ target: AsyncErrorEvent });
      const msg = manager.create();

      await expect(manager.beforePublish(msg)).rejects.toThrow("hook failed");
    });
  });

  describe("hydrate() transform error wrapping", () => {
    it("should wrap @Transform.from errors with field context", () => {
      @Namespace("test")
      @Message({ name: "BadTransformEvent" })
      class BadTransformEvent {
        @IdentifierField()
        id!: string;

        @Transform({
          to: (val: unknown) => val,
          from: () => {
            throw new Error("transform boom");
          },
        })
        @Field("string")
        data!: string;
      }

      const manager = new MessageManager({ target: BadTransformEvent });

      expect(() =>
        manager.hydrate({
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          data: "value",
        }),
      ).toThrow(/@Transform\.from failed for field "data"/);
    });
  });
});
