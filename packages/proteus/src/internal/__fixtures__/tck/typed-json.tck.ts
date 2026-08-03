// TCK: TypedJson Suite
//
// Verifies @TypedJson gives json/object/array fields lossless type fidelity:
// nested Date / Buffer / BigInt / undefined survive a write + read round-trip,
// survive an update (entity diff AND criteria-based updateMany) and a `select`
// projection, and that a missing sidecar degrades gracefully to plain data.

import { isBigInt } from "@lindorm/is";
import { beforeEach, describe, expect, test } from "vitest";
import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const typedJsonSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  caps: TckCapabilities,
) => {
  describe("TypedJson", () => {
    const { TckTypedJson, TckTypedJsonEncrypted, TckJsonHolder } = entities;

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

    test("updateMany replaces the sidecar, never joining fresh data to stale meta", async () => {
      const repo = getHandle().repository(TckTypedJson);

      const inserted = await repo.insert({
        name: "bulk",
        payload: makePayload(),
        meta: { kind: "gamma", since: new Date("2012-02-02T00:00:00.000Z") },
        optional: null,
      });

      // A payload with an entirely different type shape at every path: joining
      // this against the inserted payload's sidecar would mistype every value.
      await repo.updateMany({ name: "bulk" }, {
        payload: {
          when: "not-a-date",
          blob: 5n,
          big: new Date("2023-03-03T00:00:00.000Z"),
          nested: { count: Buffer.from("nine") },
          list: ["a", "b"],
        },
      } as any);

      const found = await repo.findOneOrFail({ id: inserted.id });
      const p = found.payload as any;

      expect(p.when).toBe("not-a-date");
      expect(typeof p.blob).toBe("bigint");
      expect(p.blob).toBe(5n);
      expect(p.big).toBeInstanceOf(Date);
      expect((p.big as Date).getTime()).toBe(
        new Date("2023-03-03T00:00:00.000Z").getTime(),
      );
      expect(Buffer.isBuffer(p.nested.count)).toBe(true);
      expect((p.nested.count as Buffer).toString()).toBe("nine");
      expect(p.list).toEqual(["a", "b"]);

      // Paths that existed only in the previous payload must be gone entirely —
      // a surviving sidecar would resurrect them as typed keys.
      expect("maybe" in p).toBe(false);
      expect("plain" in p).toBe(false);

      // The untouched sibling field keeps its own sidecar.
      expect((found.meta as any).since).toBeInstanceOf(Date);
    });

    test("select projection carries the sidecar, keeping types on a partial read", async () => {
      const repo = getHandle().repository(TckTypedJson);

      const inserted = await repo.insert({
        name: "projected",
        payload: makePayload(),
        meta: { kind: "delta", since: new Date("2013-03-03T00:00:00.000Z") },
        optional: null,
      });

      const [found] = await repo.find({ id: inserted.id }, { select: ["id", "payload"] });
      const p = found.payload as any;

      expect(found.id).toBe(inserted.id);
      expect(p.when).toBeInstanceOf(Date);
      expect(Buffer.isBuffer(p.blob)).toBe(true);
      expect((p.blob as Buffer).toString()).toBe("hello world");
      expect(typeof p.big).toBe("bigint");
      expect(p.big).toBe(9007199254740993n);
      expect(typeof p.nested.count).toBe("bigint");
      expect(p.nested.at).toBeInstanceOf(Date);
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

    // ─── @TypedJson + @Encrypted ───────────────────────────────────────
    // Split FIRST, then seal EACH half. Sealing the joined value instead would
    // hand AesKit a live BigInt (it JSON-stringifies its input, which throws)
    // and flatten a live Date to a string — losing what @TypedJson preserves.
    // The sidecar is sealed too, so the type map cannot leak the value's shape.

    if (caps.encryption) {
      describe("encrypted typed-json", () => {
        // Unique markers so a cleartext leak is unambiguous in a raw row.
        const CANARY = "canary-typedjson-must-not-be-stored-in-the-clear";
        const CANARY_BIG = 9007199254740993n;
        const CANARY_ISO = "2021-06-15T10:30:00.000Z";

        const makeEncryptedPayload = () => ({
          canary: CANARY,
          when: new Date(CANARY_ISO),
          blob: Buffer.from("hello world"),
          big: CANARY_BIG,
          maybe: undefined,
          num: 42,
          nested: {
            count: 7n,
            at: new Date("2000-01-01T00:00:00.000Z"),
            data: Buffer.from([1, 2, 3]),
          },
          list: [1n, new Date("1999-12-31T23:59:59.000Z"), "x"],
        });

        test("round-trips nested Date / Buffer / BigInt / undefined through encryption", async () => {
          const repo = getHandle().repository(TckTypedJsonEncrypted);

          const inserted = await repo.insert({
            name: "sealed",
            payload: makeEncryptedPayload(),
            optional: null,
          });

          const found = await repo.findOneOrFail({ id: inserted.id });
          const p = found.payload as any;

          expect(p.canary).toBe(CANARY);

          expect(p.when).toBeInstanceOf(Date);
          expect((p.when as Date).getTime()).toBe(new Date(CANARY_ISO).getTime());

          expect(Buffer.isBuffer(p.blob)).toBe(true);
          expect((p.blob as Buffer).toString()).toBe("hello world");

          expect(typeof p.big).toBe("bigint");
          expect(p.big).toBe(CANARY_BIG);

          expect("maybe" in p).toBe(true);
          expect(p.maybe).toBeUndefined();

          expect(p.num).toBe(42);

          expect(typeof p.nested.count).toBe("bigint");
          expect(p.nested.count).toBe(7n);
          expect(p.nested.at).toBeInstanceOf(Date);
          expect(Buffer.isBuffer(p.nested.data)).toBe(true);
          expect((p.nested.data as Buffer).equals(Buffer.from([1, 2, 3]))).toBe(true);

          expect(typeof p.list[0]).toBe("bigint");
          expect(p.list[1]).toBeInstanceOf(Date);
          expect(p.list[2]).toBe("x");

          expect(found.optional).toBeNull();
        });

        test("stores BOTH halves as ciphertext — no plaintext, no readable type map", async () => {
          const repo = getHandle().repository(TckTypedJsonEncrypted);

          await repo.insert({
            name: "sealed-at-rest",
            payload: makeEncryptedPayload(),
            optional: null,
          });

          const rows = await getHandle().readRawRows(TckTypedJsonEncrypted);
          expect(rows).toHaveLength(1);

          // Serialising the whole row catches a leak in ANY column, whatever the
          // driver named it — a round-trip assertion alone would pass even if
          // nothing had been encrypted. Drivers hand back their own scalar types
          // (sqlite returns a BigInt for a large integer, mongo a BSON Binary),
          // so everything is stringified through String() rather than trusting
          // JSON.stringify to know them.
          const stored = JSON.stringify(rows, (_key, value) =>
            isBigInt(value) ? String(value) : value,
          );

          expect(stored).not.toContain(CANARY);
          expect(stored).not.toContain(CANARY_ISO);
          expect(stored).not.toContain(String(CANARY_BIG));
          expect(stored).not.toContain("hello world");
          // The JsonKit type map spells each path's type as a one-letter code
          // (`"canary":"S"`, `"when":"D"`, …). Finding one means the sidecar
          // went to disk in the clear.
          expect(stored).not.toContain('"canary":"S"');
          expect(stored).not.toContain('"when":"D"');

          // The unencrypted `name` column proves the row really was read raw and
          // the absences above are not just an empty result.
          expect(stored).toContain("sealed-at-rest");
        });

        test("update replaces both sealed halves, never joining fresh data to stale meta", async () => {
          const repo = getHandle().repository(TckTypedJsonEncrypted);

          const inserted = await repo.insert({
            name: "sealed-update",
            payload: makeEncryptedPayload(),
            optional: null,
          });

          const entity = await repo.findOneOrFail({ id: inserted.id });
          entity.payload = {
            when: "not-a-date",
            blob: 5n,
            big: new Date("2023-03-03T00:00:00.000Z"),
          } as any;
          await repo.update(entity);

          const found = await repo.findOneOrFail({ id: inserted.id });
          const p = found.payload as any;

          expect(p.when).toBe("not-a-date");
          expect(typeof p.blob).toBe("bigint");
          expect(p.blob).toBe(5n);
          expect(p.big).toBeInstanceOf(Date);

          // Paths that existed only in the previous payload must be gone — a
          // surviving sidecar would resurrect them as typed keys.
          expect("canary" in p).toBe(false);
          expect("nested" in p).toBe(false);
        });

        test("updateMany replaces both sealed halves", async () => {
          const repo = getHandle().repository(TckTypedJsonEncrypted);

          const inserted = await repo.insert({
            name: "sealed-bulk",
            payload: makeEncryptedPayload(),
            optional: null,
          });

          await repo.updateMany({ name: "sealed-bulk" }, {
            payload: { ticket: 12345678901234567890n, at: new Date(CANARY_ISO) },
          } as any);

          const found = await repo.findOneOrFail({ id: inserted.id });
          const p = found.payload as any;

          expect(typeof p.ticket).toBe("bigint");
          expect(p.ticket).toBe(12345678901234567890n);
          expect(p.at).toBeInstanceOf(Date);
          expect("canary" in p).toBe(false);
        });

        test("nullable sealed typed-json field stores and reads null on both halves", async () => {
          const repo = getHandle().repository(TckTypedJsonEncrypted);

          const inserted = await repo.insert({
            name: "sealed-nullable",
            payload: { x: 1n },
            optional: null,
          });

          const found = await repo.findOneOrFail({ id: inserted.id });
          expect(found.optional).toBeNull();
          expect(typeof (found.payload as any).x).toBe("bigint");
        });
      });
    }

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
