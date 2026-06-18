import type { MetaGenerated, MessageMetadata } from "../types/metadata.js";
import { generateFields } from "./generate-fields.js";
import { describe, expect, it } from "vitest";

const mockMetadata = (
  generated: Array<
    Omit<MetaGenerated, "generator" | "namespace"> & {
      generator?: MetaGenerated["generator"];
      namespace?: MetaGenerated["namespace"];
    }
  >,
): MessageMetadata =>
  ({
    generated: generated.map((gen) => ({ generator: null, namespace: null, ...gen })),
  }) as unknown as MessageMetadata;

describe("generateFields", () => {
  describe("strategy: uuid", () => {
    it("should generate a valid UUID v4 string", () => {
      const metadata = mockMetadata([
        { key: "id", strategy: "uuid", length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { id: null };

      generateFields(metadata, message);

      expect(message.id).toEqual(expect.any(String));
      expect(message.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("strategy: date", () => {
    it("should generate a Date instance", () => {
      const metadata = mockMetadata([
        { key: "createdAt", strategy: "date", length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { createdAt: null };

      generateFields(metadata, message);

      expect(message.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("strategy: string", () => {
    it("should generate a string of exact requested length", () => {
      const metadata = mockMetadata([
        { key: "token", strategy: "string", length: 16, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { token: null };

      generateFields(metadata, message);

      expect(message.token).toEqual(expect.any(String));
      expect((message.token as string).length).toBe(16);
    });

    it.each([8, 16, 32])("should produce exact length %i", (length) => {
      const metadata = mockMetadata([
        { key: "token", strategy: "string", length, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { token: null };

      generateFields(metadata, message);

      expect((message.token as string).length).toBe(length);
    });

    it("should default to length 32 when length is null", () => {
      const metadata = mockMetadata([
        { key: "token", strategy: "string", length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { token: null };

      generateFields(metadata, message);

      expect((message.token as string).length).toBe(32);
    });
  });

  describe("strategy: integer", () => {
    it("should generate an integer in [min, max) range", () => {
      const metadata = mockMetadata([
        { key: "seq", strategy: "integer", length: null, min: 10, max: 20 },
      ]);
      const message: Record<string, unknown> = { seq: null };

      generateFields(metadata, message);

      expect(Number.isInteger(message.seq)).toBe(true);
      expect(message.seq as number).toBeGreaterThanOrEqual(10);
      expect(message.seq as number).toBeLessThan(20);
    });

    it("should use defaults 0..999999 when min/max are null", () => {
      const metadata = mockMetadata([
        { key: "seq", strategy: "integer", length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { seq: null };

      generateFields(metadata, message);

      expect(Number.isInteger(message.seq)).toBe(true);
      expect(message.seq as number).toBeGreaterThanOrEqual(0);
      expect(message.seq as number).toBeLessThan(999999);
    });
  });

  describe("strategy: float", () => {
    it("should generate a float in [min, max) range", () => {
      const metadata = mockMetadata([
        { key: "weight", strategy: "float", length: null, min: 0, max: 1 },
      ]);
      const message: Record<string, unknown> = { weight: null };

      generateFields(metadata, message);

      expect(message.weight).toEqual(expect.any(Number));
      expect(message.weight as number).toBeGreaterThanOrEqual(0);
      expect(message.weight as number).toBeLessThan(1);
    });

    it("should use defaults 0..999999 when min/max are null", () => {
      const metadata = mockMetadata([
        { key: "weight", strategy: "float", length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { weight: null };

      generateFields(metadata, message);

      expect(message.weight as number).toBeGreaterThanOrEqual(0);
      expect(message.weight as number).toBeLessThan(999999);
    });
  });

  describe("strategy: lindorm_id", () => {
    it("should generate a 24-char base62 string by default", () => {
      const metadata = mockMetadata([
        { key: "id", strategy: "lindorm_id", length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { id: null };

      generateFields(metadata, message);

      expect(message.id).toEqual(expect.any(String));
      expect(message.id).toMatch(/^[A-Za-z0-9]{24}$/);
    });

    it("should respect a requested length", () => {
      const metadata = mockMetadata([
        { key: "id", strategy: "lindorm_id", length: 32, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { id: null };

      generateFields(metadata, message);

      expect(message.id).toMatch(/^[A-Za-z0-9]{32}$/);
    });

    it("should prefix the id with the namespace", () => {
      const metadata = mockMetadata([
        {
          key: "id",
          strategy: "lindorm_id",
          length: null,
          min: null,
          max: null,
          namespace: "user",
        },
      ]);
      const message: Record<string, unknown> = { id: null };

      generateFields(metadata, message);

      expect(message.id).toMatch(/^user_[A-Za-z0-9]{24}$/);
    });

    it("should combine namespace with a custom length", () => {
      const metadata = mockMetadata([
        {
          key: "id",
          strategy: "lindorm_id",
          length: 32,
          min: null,
          max: null,
          namespace: "u",
        },
      ]);
      const message: Record<string, unknown> = { id: null };

      generateFields(metadata, message);

      expect(message.id).toMatch(/^u_[A-Za-z0-9]{32}$/);
    });

    it("should propagate randomId's throw for an invalid namespace", () => {
      const metadata = mockMetadata([
        {
          key: "id",
          strategy: "lindorm_id",
          length: null,
          min: null,
          max: null,
          namespace: "bad_ns",
        },
      ]);
      const message: Record<string, unknown> = { id: null };

      expect(() => generateFields(metadata, message)).toThrow();
    });
  });

  describe("custom generator", () => {
    it("should use the generator function when set, ignoring strategy", () => {
      const metadata = mockMetadata([
        {
          key: "id",
          strategy: null,
          generator: () => "custom-value",
          length: null,
          min: null,
          max: null,
        },
      ]);
      const message: Record<string, unknown> = { id: null };

      generateFields(metadata, message);

      expect(message.id).toBe("custom-value");
    });

    it("should prefer the generator over a populated strategy", () => {
      const metadata = mockMetadata([
        {
          key: "id",
          strategy: "uuid",
          generator: () => 42,
          length: null,
          min: null,
          max: null,
        },
      ]);
      const message: Record<string, unknown> = { id: null };

      generateFields(metadata, message);

      expect(message.id).toBe(42);
    });
  });

  describe("field skipping", () => {
    it("should skip fields that already have a non-null value", () => {
      const metadata = mockMetadata([
        { key: "id", strategy: "uuid", length: null, min: null, max: null },
      ]);
      const existingId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
      const message: Record<string, unknown> = { id: existingId };

      generateFields(metadata, message);

      expect(message.id).toBe(existingId);
    });

    it("should generate for fields that have null value", () => {
      const metadata = mockMetadata([
        { key: "id", strategy: "uuid", length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { id: null };

      generateFields(metadata, message);

      expect(message.id).not.toBeNull();
      expect(message.id).toEqual(expect.any(String));
    });

    it("should generate for fields that have undefined value", () => {
      const metadata = mockMetadata([
        { key: "id", strategy: "uuid", length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = {};

      generateFields(metadata, message);

      expect(message.id).toEqual(expect.any(String));
    });
  });

  describe("multiple fields", () => {
    it("should generate all fields in a single pass", () => {
      const metadata = mockMetadata([
        { key: "id", strategy: "uuid", length: null, min: null, max: null },
        { key: "createdAt", strategy: "date", length: null, min: null, max: null },
        { key: "token", strategy: "string", length: 8, min: null, max: null },
        { key: "seq", strategy: "integer", length: null, min: 1, max: 100 },
        { key: "weight", strategy: "float", length: null, min: 0, max: 1 },
      ]);
      const message: Record<string, unknown> = {
        id: null,
        createdAt: null,
        token: null,
        seq: null,
        weight: null,
      };

      generateFields(metadata, message);

      expect(message).toMatchSnapshot({
        id: expect.any(String),
        createdAt: expect.any(Date),
        token: expect.any(String),
        seq: expect.any(Number),
        weight: expect.any(Number),
      });
    });
  });

  describe("unknown strategy", () => {
    it("should set field to null for an unknown strategy", () => {
      const metadata = mockMetadata([
        { key: "x", strategy: "bogus" as any, length: null, min: null, max: null },
      ]);
      const message: Record<string, unknown> = { x: null };

      generateFields(metadata, message);

      expect(message.x).toBeNull();
    });
  });
});
