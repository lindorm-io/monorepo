// TCK: TypedJson Suite
//
// Verifies @TypedJson gives json/object/array fields lossless type fidelity:
// nested Date / Buffer / BigInt / undefined survive a write + read round-trip,
// survive an update, and that a missing sidecar degrades gracefully to plain data.

import { beforeEach, describe, expect, test } from "vitest";
import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const typedJsonSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("TypedJson", () => {
    const { TckTypedJson, TckJsonHolder } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    const makePayload = () => ({
      when: new Date("2021-06-15T10:30:00.000Z"),
      blob: Buffer.from("hello world"),
      big: 9007199254740993n, // beyond Number.MAX_SAFE_INTEGER
      maybe: undefined,
      plain: "text",
      num: 42,
      flag: true,
      nested: {
        count: 7n,
        at: new Date("2000-01-01T00:00:00.000Z"),
        data: Buffer.from([1, 2, 3]),
      },
      list: [1n, new Date("1999-12-31T23:59:59.000Z"), "x"],
    });

    test("round-trips nested Date / Buffer / BigInt / undefined as original types", async () => {
      const repo = getHandle().repository(TckTypedJson);

      const inserted = await repo.insert({
        name: "complex",
        payload: makePayload(),
        meta: { kind: "alpha", since: new Date("2010-05-05T05:05:05.000Z") },
        optional: null,
      });

      const found = await repo.findOneOrFail({ id: inserted.id });
      const p = found.payload as any;

      expect(p.when).toBeInstanceOf(Date);
      expect((p.when as Date).getTime()).toBe(
        new Date("2021-06-15T10:30:00.000Z").getTime(),
      );

      expect(Buffer.isBuffer(p.blob)).toBe(true);
      expect((p.blob as Buffer).toString()).toBe("hello world");

      expect(typeof p.big).toBe("bigint");
      expect(p.big).toBe(9007199254740993n);

      expect("maybe" in p).toBe(true);
      expect(p.maybe).toBeUndefined();

      expect(p.plain).toBe("text");
      expect(p.num).toBe(42);
      expect(p.flag).toBe(true);

      expect(typeof p.nested.count).toBe("bigint");
      expect(p.nested.count).toBe(7n);
      expect(p.nested.at).toBeInstanceOf(Date);
      expect(Buffer.isBuffer(p.nested.data)).toBe(true);
      expect((p.nested.data as Buffer).equals(Buffer.from([1, 2, 3]))).toBe(true);

      expect(typeof p.list[0]).toBe("bigint");
      expect(p.list[1]).toBeInstanceOf(Date);
      expect(p.list[2]).toBe("x");

      // Explicit-named sidecar column (@TypedJson({ name: "meta_types" }))
      const m = found.meta as any;
      expect(m.kind).toBe("alpha");
      expect(m.since).toBeInstanceOf(Date);

      expect(found.optional).toBeNull();
    });

    test("survives an update (partial diff) preserving types", async () => {
      const repo = getHandle().repository(TckTypedJson);

      const inserted = await repo.insert({
        name: "updatable",
        payload: makePayload(),
        meta: { kind: "beta", since: new Date("2011-01-01T00:00:00.000Z") },
        optional: null,
      });

      inserted.payload = {
        when: new Date("2022-12-25T00:00:00.000Z"),
        ticket: 12345678901234567890n,
        bytes: Buffer.from("updated"),
        gone: undefined,
      } as any;
      await repo.update(inserted);

      const found = await repo.findOneOrFail({ id: inserted.id });
      const p = found.payload as any;

      expect(p.when).toBeInstanceOf(Date);
      expect((p.when as Date).getTime()).toBe(
        new Date("2022-12-25T00:00:00.000Z").getTime(),
      );
      expect(typeof p.ticket).toBe("bigint");
      expect(p.ticket).toBe(12345678901234567890n);
      expect(Buffer.isBuffer(p.bytes)).toBe(true);
      expect((p.bytes as Buffer).toString()).toBe("updated");
      expect("gone" in p).toBe(true);
      expect(p.gone).toBeUndefined();

      // untouched field still intact
      expect((found.meta as any).since).toBeInstanceOf(Date);
    });

    test("plain JSON values round-trip unchanged (no special types)", async () => {
      const repo = getHandle().repository(TckTypedJson);

      const inserted = await repo.insert({
        name: "plain",
        payload: { a: 1, b: "two", c: [3, 4], d: { e: true } },
        meta: { ok: true },
        optional: { note: "set" },
      });

      const found = await repo.findOneOrFail({ id: inserted.id });

      expect(found.payload).toEqual({ a: 1, b: "two", c: [3, 4], d: { e: true } });
      expect(found.meta).toEqual({ ok: true });
      expect(found.optional).toEqual({ note: "set" });
    });

    test("nullable typed-json field stores and reads null on both columns", async () => {
      const repo = getHandle().repository(TckTypedJson);

      const inserted = await repo.insert({
        name: "nullable",
        payload: { x: 1n },
        meta: { y: 2 },
        optional: null,
      });

      const found = await repo.findOneOrFail({ id: inserted.id });
      expect(found.optional).toBeNull();
      expect(typeof (found.payload as any).x).toBe("bigint");
    });

    // ─── Phase 3: a PLAIN (non-@TypedJson) json field rejects complex types ────
    describe("plain json fields reject unserialisable types", () => {
      test("inserting a Date into a plain @Field(json) throws, naming @TypedJson", async () => {
        const repo = getHandle().repository(TckJsonHolder);

        await expect(
          repo.insert({
            metadata: { when: new Date("2021-01-01T00:00:00.000Z") },
            settings: { theme: "dark", count: 1 },
            payload: { items: [], count: 0 },
          }),
        ).rejects.toThrow(/json field "metadata"/);
      });

      test.each([
        ["a Buffer", { blob: Buffer.from("x") }],
        ["a BigInt", { big: 1n }],
        ["a Map", { m: new Map([["k", 1]]) }],
        ["a Set", { s: new Set([1]) }],
      ])("inserting %s into a plain json field throws", async (_label, metadata) => {
        const repo = getHandle().repository(TckJsonHolder);

        await expect(
          repo.insert({
            metadata: metadata as Record<string, unknown>,
            settings: { theme: "dark", count: 1 },
            payload: { items: [], count: 0 },
          }),
        ).rejects.toThrow();
      });

      test("plain JSON-native values are accepted on a plain json field", async () => {
        const repo = getHandle().repository(TckJsonHolder);

        const inserted = await repo.insert({
          metadata: { a: 1, b: "x", c: [true, null, { d: 2 }] },
          settings: { theme: "light", count: 3 },
          payload: { items: ["one", "two"], count: 2 },
        });

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.metadata).toEqual({ a: 1, b: "x", c: [true, null, { d: 2 }] });
      });
    });
  });
};
