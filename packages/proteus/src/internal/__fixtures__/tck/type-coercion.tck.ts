import { describe, test, expect, beforeEach } from "vitest";
// TCK: Type Coercion Suite
// Asserts divergent column types round-trip with IDENTICAL runtime types
// and values across every driver. Memory stores via structuredClone (which
// turns a Buffer into a Uint8Array); SQL drivers return their own native
// representations. The shared `deserialise` step normalises all of them.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const typeCoercionSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Type Coercion", () => {
    const { TckTypeHolder } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("bigint round-trips as a JS bigint with the same value", async () => {
      const repo = getHandle().repository(TckTypeHolder);
      const inserted = await repo.insert({
        bigValue: 9007199254740993n,
        decimalValue: "1.0000",
        binaryValue: Buffer.from([0]),
      });

      const found = await repo.findOneOrFail({ id: inserted.id });

      expect(typeof found.bigValue).toBe("bigint");
      expect(found.bigValue).toBe(9007199254740993n);
      expect(typeof inserted.bigValue).toBe("bigint");
      expect(inserted.bigValue).toBe(9007199254740993n);
    });

    test("decimal round-trips as a precision-preserving string", async () => {
      const repo = getHandle().repository(TckTypeHolder);
      const inserted = await repo.insert({
        bigValue: 1n,
        decimalValue: "12345.6789",
        binaryValue: Buffer.from([0]),
      });

      const found = await repo.findOneOrFail({ id: inserted.id });

      expect(typeof found.decimalValue).toBe("string");
      expect(found.decimalValue).toBe("12345.6789");
    });

    test("binary round-trips as a Node Buffer with byte equality", async () => {
      const repo = getHandle().repository(TckTypeHolder);
      const bytes = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      const inserted = await repo.insert({
        bigValue: 1n,
        decimalValue: "0.0000",
        binaryValue: bytes,
      });

      const found = await repo.findOneOrFail({ id: inserted.id });

      expect(Buffer.isBuffer(found.binaryValue)).toBe(true);
      expect(Buffer.isBuffer(inserted.binaryValue)).toBe(true);
      expect(found.binaryValue.equals(bytes)).toBe(true);
      expect(inserted.binaryValue.equals(bytes)).toBe(true);
    });
  });
};
