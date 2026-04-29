import type { IMessage } from "../../../interfaces/index.js";
import { Compressed } from "../../../decorators/Compressed.js";
import { Field } from "../../../decorators/Field.js";
import { Generated } from "../../../decorators/Generated.js";
import { Header } from "../../../decorators/Header.js";
import { Message } from "../../../decorators/Message.js";
import { Nullable } from "../../../decorators/Nullable.js";
import { Transform } from "../../../decorators/Transform.js";
import { MessageManager } from "../classes/MessageManager.js";
import { getMessageMetadata } from "../metadata/get-message-metadata.js";
import { clearRegistry } from "../metadata/registry.js";
import { prepareInbound } from "./prepare-inbound.js";
import { prepareOutbound } from "./prepare-outbound.js";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  clearRegistry();
});

// Helper to stabilise non-deterministic values for snapshot comparison
const stabilise = (
  obj: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> => {
  const clone = { ...obj };
  for (const key of keys) {
    if (clone[key] instanceof Date) {
      clone[key] = "[DATE]";
    } else if (
      typeof clone[key] === "string" &&
      /^[0-9a-f-]{36}$/i.test(clone[key] as string)
    ) {
      clone[key] = "[UUID]";
    } else if (typeof clone[key] === "string") {
      clone[key] = "[GENERATED_STRING]";
    } else if (typeof clone[key] === "number") {
      clone[key] = "[GENERATED_NUMBER]";
    }
  }
  return clone;
};

const roundTrip = async <M extends IMessage>(
  manager: MessageManager<M>,
  input: Partial<M>,
): Promise<{ original: M; hydrated: M }> => {
  const original = manager.create(input);
  manager.validate(original);

  const { payload, headers } = await prepareOutbound(original, manager.metadata);
  const inboundData = await prepareInbound(payload, headers, manager.metadata);
  const hydrated = manager.hydrate(inboundData);

  return { original, hydrated };
};

describe("pipeline round-trip", () => {
  describe("plain message with basic field types", () => {
    it("should round-trip string, integer, boolean, and date fields", async () => {
      @Message({ name: "PlainMsg" })
      class PlainMsg implements IMessage {
        @Field("string")
        name!: string;

        @Field("integer")
        count!: number;

        @Field("boolean")
        active!: boolean;

        @Field("date")
        createdAt!: Date;
      }

      const now = new Date("2025-06-15T12:00:00.000Z");
      const manager = new MessageManager({ target: PlainMsg });

      const { original, hydrated } = await roundTrip(manager, {
        name: "hello",
        count: 42,
        active: true,
        createdAt: now,
      } as Partial<PlainMsg>);

      expect(hydrated.name).toBe(original.name);
      expect(hydrated.count).toBe(original.count);
      expect(hydrated.active).toBe(original.active);
      expect(hydrated.createdAt).toEqual(original.createdAt);

      expect({
        name: hydrated.name,
        count: hydrated.count,
        active: hydrated.active,
        createdAt: hydrated.createdAt.toISOString(),
      }).toMatchSnapshot();
    });
  });

  describe("message with @Header fields", () => {
    it("should extract headers during serialize and reattach during deserialize", async () => {
      @Message({ name: "HeaderMsg" })
      class HeaderMsg implements IMessage {
        @Field("string")
        body!: string;

        @Field("string")
        @Header("x-trace-id")
        traceId!: string;

        @Field("string")
        @Header("x-user-id")
        userId!: string;
      }

      const manager = new MessageManager({ target: HeaderMsg });

      const { original, hydrated } = await roundTrip(manager, {
        body: "payload-content",
        traceId: "trace-abc-123",
        userId: "user-xyz-789",
      } as Partial<HeaderMsg>);

      expect(hydrated.body).toBe(original.body);
      expect(hydrated.traceId).toBe(original.traceId);
      expect(hydrated.userId).toBe(original.userId);

      expect({
        body: hydrated.body,
        traceId: hydrated.traceId,
        userId: hydrated.userId,
      }).toMatchSnapshot();
    });

    it("should handle a single header field", async () => {
      @Message({ name: "SingleHeaderMsg" })
      class SingleHeaderMsg implements IMessage {
        @Field("string")
        content!: string;

        @Field("string")
        @Header("x-request-id")
        requestId!: string;
      }

      const manager = new MessageManager({ target: SingleHeaderMsg });
      const { original, hydrated } = await roundTrip(manager, {
        content: "data",
        requestId: "req-001",
      } as Partial<SingleHeaderMsg>);

      expect(hydrated.requestId).toBe(original.requestId);
      expect(hydrated.content).toBe(original.content);
    });
  });

  describe("message with @Transform", () => {
    it("should apply transform.to during serialize and transform.from during hydrate", async () => {
      @Message({ name: "TransformMsg" })
      class TransformMsg implements IMessage {
        @Field("string")
        @Transform({
          to: (v: unknown) => (v as string).toUpperCase(),
          from: (v: unknown) => (v as string).toLowerCase(),
        })
        label!: string;

        @Field("integer")
        value!: number;
      }

      const manager = new MessageManager({ target: TransformMsg });
      const { original, hydrated } = await roundTrip(manager, {
        label: "Hello World",
        value: 99,
      } as Partial<TransformMsg>);

      // transform.from returns lowercase
      expect(hydrated.label).toBe("hello world");
      // The original was stored as-is on the message object
      expect(original.label).toBe("Hello World");
      expect(hydrated.value).toBe(original.value);

      expect({
        label: hydrated.label,
        value: hydrated.value,
      }).toMatchSnapshot();
    });

    it("should round-trip numeric transform (celsius to fahrenheit and back)", async () => {
      @Message({ name: "NumericTransformMsg" })
      class NumericTransformMsg implements IMessage {
        @Field("float")
        @Transform({
          to: (v: unknown) => ((v as number) * 9) / 5 + 32,
          from: (v: unknown) => (((v as number) - 32) * 5) / 9,
        })
        temperature!: number;
      }

      const manager = new MessageManager({ target: NumericTransformMsg });

      const { original, hydrated } = await roundTrip(manager, {
        temperature: 100,
      } as any);

      // The original holds 100 (celsius), transform.from converts the stored fahrenheit back
      expect(original.temperature).toBe(100);
      expect(hydrated.temperature).toBeCloseTo(100, 10);
    });
  });

  describe("message with gzip compression", () => {
    it("should round-trip compressed payload correctly", async () => {
      @Compressed("gzip")
      @Message({ name: "GzipMsg" })
      class GzipMsg implements IMessage {
        @Field("string")
        data!: string;

        @Field("integer")
        sequence!: number;
      }

      const manager = new MessageManager({ target: GzipMsg });
      const { original, hydrated } = await roundTrip(manager, {
        data: "compressed-content",
        sequence: 7,
      } as Partial<GzipMsg>);

      expect(hydrated.data).toBe(original.data);
      expect(hydrated.sequence).toBe(original.sequence);

      expect({
        data: hydrated.data,
        sequence: hydrated.sequence,
      }).toMatchSnapshot();
    });

    it("should round-trip large payload with gzip", async () => {
      @Compressed("gzip")
      @Message({ name: "GzipLargeMsg" })
      class GzipLargeMsg implements IMessage {
        @Field("string")
        payload!: string;
      }

      const manager = new MessageManager({ target: GzipLargeMsg });
      const largeString = "x".repeat(10_000);

      const { original, hydrated } = await roundTrip(manager, {
        payload: largeString,
      } as Partial<GzipLargeMsg>);

      expect(hydrated.payload).toBe(original.payload);
      expect(hydrated.payload.length).toBe(10_000);
    });
  });

  describe("message with deflate compression", () => {
    it("should round-trip compressed payload correctly", async () => {
      @Compressed("deflate")
      @Message({ name: "DeflateMsg" })
      class DeflateMsg implements IMessage {
        @Field("string")
        data!: string;

        @Field("float")
        temperature!: number;
      }

      const manager = new MessageManager({ target: DeflateMsg });
      const { original, hydrated } = await roundTrip(manager, {
        data: "deflate-test",
        temperature: 36.6,
      } as Partial<DeflateMsg>);

      expect(hydrated.data).toBe(original.data);
      expect(hydrated.temperature).toBe(original.temperature);

      expect({
        data: hydrated.data,
        temperature: hydrated.temperature,
      }).toMatchSnapshot();
    });
  });

  describe("message with brotli compression", () => {
    it("should round-trip compressed payload correctly", async () => {
      @Compressed("brotli")
      @Message({ name: "BrotliMsg" })
      class BrotliMsg implements IMessage {
        @Field("string")
        data!: string;

        @Field("boolean")
        flag!: boolean;
      }

      const manager = new MessageManager({ target: BrotliMsg });
      const { original, hydrated } = await roundTrip(manager, {
        data: "brotli-test-payload",
        flag: false,
      } as Partial<BrotliMsg>);

      expect(hydrated.data).toBe(original.data);
      expect(hydrated.flag).toBe(original.flag);

      expect({
        data: hydrated.data,
        flag: hydrated.flag,
      }).toMatchSnapshot();
    });

    it("should round-trip repeated-pattern payload efficiently with brotli", async () => {
      @Compressed("brotli")
      @Message({ name: "BrotliRepeatMsg" })
      class BrotliRepeatMsg implements IMessage {
        @Field("string")
        content!: string;
      }

      const manager = new MessageManager({ target: BrotliRepeatMsg });
      const repeatedContent = "abcdef".repeat(5_000);

      const { original, hydrated } = await roundTrip(manager, {
        content: repeatedContent,
      } as Partial<BrotliRepeatMsg>);

      expect(hydrated.content).toBe(original.content);
      expect(hydrated.content.length).toBe(30_000);
    });
  });

  describe("message with nullable fields", () => {
    it("should round-trip null values for nullable fields", async () => {
      @Message({ name: "NullableMsg" })
      class NullableMsg implements IMessage {
        @Field("string")
        required!: string;

        @Nullable()
        @Field("string")
        optionalName!: string | null;

        @Nullable()
        @Field("integer")
        optionalCount!: number | null;

        @Nullable()
        @Field("date")
        optionalDate!: Date | null;

        @Nullable()
        @Field("boolean")
        optionalFlag!: boolean | null;
      }

      const manager = new MessageManager({ target: NullableMsg });
      const { original, hydrated } = await roundTrip(manager, {
        required: "present",
        optionalName: null,
        optionalCount: null,
        optionalDate: null,
        optionalFlag: null,
      } as Partial<NullableMsg>);

      expect(hydrated.required).toBe(original.required);
      expect(hydrated.optionalName).toBeNull();
      expect(hydrated.optionalCount).toBeNull();
      expect(hydrated.optionalDate).toBeNull();
      expect(hydrated.optionalFlag).toBeNull();

      expect({
        required: hydrated.required,
        optionalName: hydrated.optionalName,
        optionalCount: hydrated.optionalCount,
        optionalDate: hydrated.optionalDate,
        optionalFlag: hydrated.optionalFlag,
      }).toMatchSnapshot();
    });

    it("should round-trip mix of null and non-null values", async () => {
      @Message({ name: "MixedNullableMsg" })
      class MixedNullableMsg implements IMessage {
        @Nullable()
        @Field("string")
        name!: string | null;

        @Nullable()
        @Field("integer")
        age!: number | null;
      }

      const manager = new MessageManager({ target: MixedNullableMsg });
      const { original, hydrated } = await roundTrip(manager, {
        name: "Alice",
        age: null,
      } as Partial<MixedNullableMsg>);

      expect(hydrated.name).toBe(original.name);
      expect(hydrated.age).toBeNull();
    });
  });

  describe("message with @Generated fields", () => {
    it("should preserve generated uuid through the pipeline", async () => {
      @Message({ name: "GeneratedUuidMsg" })
      class GeneratedUuidMsg implements IMessage {
        @Field("uuid")
        @Generated("uuid")
        id!: string;

        @Field("string")
        name!: string;
      }

      const manager = new MessageManager({ target: GeneratedUuidMsg });
      const { original, hydrated } = await roundTrip(manager, {
        name: "test",
      } as Partial<GeneratedUuidMsg>);

      expect(original.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(hydrated.id).toBe(original.id);
      expect(hydrated.name).toBe(original.name);
    });

    it("should preserve generated date through the pipeline", async () => {
      @Message({ name: "GeneratedDateMsg" })
      class GeneratedDateMsg implements IMessage {
        @Field("date")
        @Generated("date")
        createdAt!: Date;

        @Field("string")
        label!: string;
      }

      const manager = new MessageManager({ target: GeneratedDateMsg });
      const { original, hydrated } = await roundTrip(manager, {
        label: "test-date",
      } as Partial<GeneratedDateMsg>);

      expect(original.createdAt).toBeInstanceOf(Date);
      expect(hydrated.createdAt).toEqual(original.createdAt);
      expect(hydrated.label).toBe(original.label);
    });

    it("should preserve generated string through the pipeline", async () => {
      @Message({ name: "GeneratedStringMsg" })
      class GeneratedStringMsg implements IMessage {
        @Field("string")
        @Generated("string", { length: 16 })
        code!: string;

        @Field("integer")
        value!: number;
      }

      const manager = new MessageManager({ target: GeneratedStringMsg });
      const { original, hydrated } = await roundTrip(manager, {
        value: 100,
      } as Partial<GeneratedStringMsg>);

      expect(typeof original.code).toBe("string");
      expect(original.code.length).toBe(16);
      expect(hydrated.code).toBe(original.code);
      expect(hydrated.value).toBe(original.value);
    });

    it("should preserve generated integer through the pipeline", async () => {
      @Message({ name: "GeneratedIntMsg" })
      class GeneratedIntMsg implements IMessage {
        @Field("integer")
        @Generated("integer", { min: 100, max: 999 })
        seq!: number;

        @Field("string")
        tag!: string;
      }

      const manager = new MessageManager({ target: GeneratedIntMsg });
      const { original, hydrated } = await roundTrip(manager, {
        tag: "gen-int",
      } as Partial<GeneratedIntMsg>);

      expect(original.seq).toBeGreaterThanOrEqual(100);
      expect(original.seq).toBeLessThan(999);
      expect(hydrated.seq).toBe(original.seq);
    });

    it("should allow user-provided values to override generated fields", async () => {
      @Message({ name: "GeneratedOverrideMsg" })
      class GeneratedOverrideMsg implements IMessage {
        @Field("uuid")
        @Generated("uuid")
        id!: string;

        @Field("string")
        name!: string;
      }

      const manager = new MessageManager({ target: GeneratedOverrideMsg });
      const customId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

      const { original, hydrated } = await roundTrip(manager, {
        id: customId,
        name: "overridden",
      } as Partial<GeneratedOverrideMsg>);

      expect(original.id).toBe(customId);
      expect(hydrated.id).toBe(customId);
      expect(hydrated.name).toBe("overridden");

      expect({
        id: hydrated.id,
        name: hydrated.name,
      }).toMatchSnapshot();
    });
  });

  describe("message with bigint field", () => {
    it("should round-trip bigint values correctly", async () => {
      @Message({ name: "BigintMsg" })
      class BigintMsg implements IMessage {
        @Field("bigint")
        largeNumber!: bigint;

        @Field("string")
        label!: string;
      }

      const manager = new MessageManager({ target: BigintMsg });
      const { original, hydrated } = await roundTrip(manager, {
        largeNumber: 9007199254740993n,
        label: "big",
      } as Partial<BigintMsg>);

      expect(hydrated.largeNumber).toBe(original.largeNumber);
      expect(hydrated.largeNumber).toBe(9007199254740993n);
      expect(hydrated.label).toBe(original.label);
    });

    it("should round-trip zero bigint", async () => {
      @Message({ name: "BigintZeroMsg" })
      class BigintZeroMsg implements IMessage {
        @Field("bigint")
        value!: bigint;
      }

      const manager = new MessageManager({ target: BigintZeroMsg });
      const { original, hydrated } = await roundTrip(manager, {
        value: 0n,
      } as Partial<BigintZeroMsg>);

      expect(hydrated.value).toBe(original.value);
      expect(hydrated.value).toBe(0n);
    });

    it("should round-trip negative bigint", async () => {
      @Message({ name: "BigintNegMsg" })
      class BigintNegMsg implements IMessage {
        @Field("bigint")
        value!: bigint;
      }

      const manager = new MessageManager({ target: BigintNegMsg });
      const { original, hydrated } = await roundTrip(manager, {
        value: -123456789012345678n,
      } as Partial<BigintNegMsg>);

      expect(hydrated.value).toBe(original.value);
      expect(hydrated.value).toBe(-123456789012345678n);
    });
  });

  describe("message with array and object fields", () => {
    it("should round-trip array fields", async () => {
      @Message({ name: "ArrayMsg" })
      class ArrayMsg implements IMessage {
        @Field("array")
        items!: Array<unknown>;

        @Field("string")
        tag!: string;
      }

      const manager = new MessageManager({ target: ArrayMsg });
      const { original, hydrated } = await roundTrip(manager, {
        items: [1, "two", true, null, { nested: "obj" }],
        tag: "arr",
      } as Partial<ArrayMsg>);

      expect(hydrated.items).toEqual(original.items);
      expect(hydrated.tag).toBe(original.tag);

      expect({
        items: hydrated.items,
        tag: hydrated.tag,
      }).toMatchSnapshot();
    });

    it("should round-trip empty array", async () => {
      @Message({ name: "EmptyArrayMsg" })
      class EmptyArrayMsg implements IMessage {
        @Field("array")
        items!: Array<unknown>;
      }

      const manager = new MessageManager({ target: EmptyArrayMsg });
      const { original, hydrated } = await roundTrip(manager, {
        items: [],
      } as Partial<EmptyArrayMsg>);

      expect(hydrated.items).toEqual(original.items);
      expect(hydrated.items).toEqual([]);
    });

    it("should round-trip object fields", async () => {
      @Message({ name: "ObjectMsg" })
      class ObjectMsg implements IMessage {
        @Field("object")
        config!: Record<string, unknown>;

        @Field("string")
        version!: string;
      }

      const manager = new MessageManager({ target: ObjectMsg });
      const { original, hydrated } = await roundTrip(manager, {
        config: {
          host: "localhost",
          port: 8080,
          nested: { deep: { value: true } },
          tags: ["a", "b"],
        },
        version: "1.0.0",
      } as Partial<ObjectMsg>);

      expect(hydrated.config).toEqual(original.config);
      expect(hydrated.version).toBe(original.version);

      expect({
        config: hydrated.config,
        version: hydrated.version,
      }).toMatchSnapshot();
    });

    it("should round-trip empty object", async () => {
      @Message({ name: "EmptyObjectMsg" })
      class EmptyObjectMsg implements IMessage {
        @Field("object")
        data!: Record<string, unknown>;
      }

      const manager = new MessageManager({ target: EmptyObjectMsg });
      const { original, hydrated } = await roundTrip(manager, {
        data: {},
      } as Partial<EmptyObjectMsg>);

      expect(hydrated.data).toEqual(original.data);
      expect(hydrated.data).toEqual({});
    });

    it("should round-trip deeply nested structure", async () => {
      @Message({ name: "DeepNestedMsg" })
      class DeepNestedMsg implements IMessage {
        @Field("object")
        nested!: Record<string, unknown>;
      }

      const manager = new MessageManager({ target: DeepNestedMsg });
      const deepObj = {
        a: { b: { c: { d: { e: { f: "deep" } } } } },
        list: [
          [1, 2],
          [3, [4, 5]],
        ],
      };

      const { original, hydrated } = await roundTrip(manager, {
        nested: deepObj,
      } as Partial<DeepNestedMsg>);

      expect(hydrated.nested).toEqual(original.nested);
      expect(hydrated.nested).toMatchSnapshot();
    });
  });

  describe("message with multiple features combined", () => {
    it("should round-trip with compression + headers + transforms + nullable + generated", async () => {
      @Compressed("gzip")
      @Message({ name: "KitchenSinkMsg" })
      class KitchenSinkMsg implements IMessage {
        @Field("uuid")
        @Generated("uuid")
        id!: string;

        @Field("date")
        @Generated("date")
        timestamp!: Date;

        @Field("string")
        @Header("x-trace-id")
        traceId!: string;

        @Field("string")
        @Transform({
          to: (v: unknown) => Buffer.from(v as string).toString("base64"),
          from: (v: unknown) => Buffer.from(v as string, "base64").toString("utf-8"),
        })
        secret!: string;

        @Nullable()
        @Field("string")
        optionalNote!: string | null;

        @Field("integer")
        count!: number;

        @Field("boolean")
        active!: boolean;

        @Field("array")
        tags!: Array<string>;

        @Field("object")
        metadata!: Record<string, unknown>;
      }

      const manager = new MessageManager({ target: KitchenSinkMsg });
      const { original, hydrated } = await roundTrip(manager, {
        traceId: "trace-combined-001",
        secret: "super-secret-value",
        optionalNote: null,
        count: 42,
        active: true,
        tags: ["alpha", "beta", "gamma"],
        metadata: { env: "test", retries: 3, nested: { ok: true } },
      } as Partial<KitchenSinkMsg>);

      // Generated fields survive the trip
      expect(hydrated.id).toBe(original.id);
      expect(hydrated.timestamp).toEqual(original.timestamp);

      // Header field survives
      expect(hydrated.traceId).toBe(original.traceId);

      // Transform: to encodes to base64, from decodes back
      expect(hydrated.secret).toBe("super-secret-value");

      // Nullable field stays null
      expect(hydrated.optionalNote).toBeNull();

      // Basic fields
      expect(hydrated.count).toBe(original.count);
      expect(hydrated.active).toBe(original.active);

      // Complex fields
      expect(hydrated.tags).toEqual(original.tags);
      expect(hydrated.metadata).toEqual(original.metadata);

      // Snapshot with stabilised non-deterministic values
      const snapshot = stabilise(
        {
          id: hydrated.id,
          timestamp: hydrated.timestamp,
          traceId: hydrated.traceId,
          secret: hydrated.secret,
          optionalNote: hydrated.optionalNote,
          count: hydrated.count,
          active: hydrated.active,
          tags: hydrated.tags,
          metadata: hydrated.metadata,
        },
        ["id", "timestamp"],
      );
      expect(snapshot).toMatchSnapshot();
    });

    it("should round-trip with deflate compression + headers + non-null nullable", async () => {
      @Compressed("deflate")
      @Message({ name: "DeflateComboMsg" })
      class DeflateComboMsg implements IMessage {
        @Field("string")
        @Header("x-correlation-id")
        correlationId!: string;

        @Nullable()
        @Field("string")
        description!: string | null;

        @Field("integer")
        priority!: number;
      }

      const manager = new MessageManager({ target: DeflateComboMsg });
      const { original, hydrated } = await roundTrip(manager, {
        correlationId: "corr-xyz-789",
        description: "present-value",
        priority: 5,
      } as Partial<DeflateComboMsg>);

      expect(hydrated.correlationId).toBe(original.correlationId);
      expect(hydrated.description).toBe(original.description);
      expect(hydrated.priority).toBe(original.priority);

      expect({
        correlationId: hydrated.correlationId,
        description: hydrated.description,
        priority: hydrated.priority,
      }).toMatchSnapshot();
    });

    it("should round-trip with brotli compression + transform + generated", async () => {
      @Compressed("brotli")
      @Message({ name: "BrotliComboMsg" })
      class BrotliComboMsg implements IMessage {
        @Field("string")
        @Generated("string", { length: 8 })
        token!: string;

        @Field("integer")
        @Transform({
          to: (v: unknown) => (v as number) * 100,
          from: (v: unknown) => (v as number) / 100,
        })
        percentage!: number;

        @Field("string")
        label!: string;
      }

      const manager = new MessageManager({ target: BrotliComboMsg });
      const { original, hydrated } = await roundTrip(manager, {
        percentage: 75,
        label: "brotli-combo",
      } as Partial<BrotliComboMsg>);

      // Generated token survives
      expect(hydrated.token).toBe(original.token);
      expect(hydrated.token.length).toBe(8);

      // Transform: to multiplies by 100, from divides by 100
      expect(hydrated.percentage).toBe(75);
      expect(hydrated.label).toBe(original.label);
    });

    it("should round-trip with all three compression algorithms producing same result", async () => {
      const input = { data: "same-content-different-compression", value: 123 };

      const createCompressedManager = (
        algorithm: "gzip" | "deflate" | "brotli",
        className: string,
      ) => {
        @Compressed(algorithm)
        @Message({ name: className })
        class CompMsg implements IMessage {
          @Field("string")
          data!: string;

          @Field("integer")
          value!: number;
        }

        return new MessageManager({ target: CompMsg });
      };

      const gzipManager = createCompressedManager("gzip", "CompGzipMsg");
      const deflateManager = createCompressedManager("deflate", "CompDeflateMsg");
      const brotliManager = createCompressedManager("brotli", "CompBrotliMsg");

      const [gzipResult, deflateResult, brotliResult] = await Promise.all([
        roundTrip(gzipManager, input as any),
        roundTrip(deflateManager, input as any),
        roundTrip(brotliManager, input as any),
      ]);

      // All three should produce identical hydrated values
      expect(gzipResult.hydrated.data).toBe(input.data);
      expect(deflateResult.hydrated.data).toBe(input.data);
      expect(brotliResult.hydrated.data).toBe(input.data);

      expect(gzipResult.hydrated.value).toBe(input.value);
      expect(deflateResult.hydrated.value).toBe(input.value);
      expect(brotliResult.hydrated.value).toBe(input.value);
    });
  });
});
