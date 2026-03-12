// TCK: Encryption Suite
// Tests field-level encryption via @Encrypted decorator across all drivers.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";

export const encryptionSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Encryption", () => {
    const { TckEncrypted } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    // ─── Basic Round-Trip ──────────────────────────────────────────────

    describe("basic round-trip", () => {
      test("encrypted string field round-trips correctly", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "my-secret-value",
          pin: 1234,
          verified: true,
          metadata: { key: "value" },
          optionalSecret: null,
          transformedSecret: "hello",
        });

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.secret).toBe("my-secret-value");
      });

      test("encrypted integer field round-trips with correct type", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "s",
          pin: 9876,
          verified: false,
          metadata: { n: 1 },
          optionalSecret: null,
          transformedSecret: "test",
        });

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(typeof found.pin).toBe("number");
        expect(found.pin).toBe(9876);
      });

      test("encrypted boolean field round-trips correctly", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "s",
          pin: 1,
          verified: true,
          metadata: {},
          optionalSecret: null,
          transformedSecret: "test",
        });

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.verified).toBe(true);
      });

      test("encrypted json/object field round-trips with deep equality", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const meta = { nested: { deep: true }, items: [1, 2, 3], label: "test" };
        const inserted = await repo.insert({
          secret: "s",
          pin: 0,
          verified: false,
          metadata: meta,
          optionalSecret: null,
          transformedSecret: "test",
        });

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.metadata).toMatchSnapshot();
      });
    });

    // ─── Null Handling ─────────────────────────────────────────────────

    describe("null handling", () => {
      test("nullable encrypted field preserves null", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "s",
          pin: 1,
          verified: false,
          metadata: {},
          optionalSecret: null,
          transformedSecret: "test",
        });

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.optionalSecret).toBeNull();
      });

      test("update nullable encrypted field from null to value", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "s",
          pin: 1,
          verified: false,
          metadata: {},
          optionalSecret: null,
          transformedSecret: "test",
        });

        const entity = await repo.findOneOrFail({ id: inserted.id });
        entity.optionalSecret = "now-has-value";
        await repo.update(entity);

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.optionalSecret).toBe("now-has-value");
      });

      test("update nullable encrypted field from value to null", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "s",
          pin: 1,
          verified: false,
          metadata: {},
          optionalSecret: "has-value",
          transformedSecret: "test",
        });

        const entity = await repo.findOneOrFail({ id: inserted.id });
        entity.optionalSecret = null;
        await repo.update(entity);

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.optionalSecret).toBeNull();
      });
    });

    // ─── Transform + Encrypted Composition ─────────────────────────────

    describe("transform + encrypted composition", () => {
      test("transform.from is applied after decryption", async () => {
        const repo = getHandle().repository(TckEncrypted);
        // Pipeline: "hello" -> toUpperCase -> "HELLO" -> encrypt -> ciphertext
        // Read:    ciphertext -> decrypt -> "HELLO" -> toLowerCase -> "hello"
        const inserted = await repo.insert({
          secret: "s",
          pin: 1,
          verified: false,
          metadata: {},
          optionalSecret: null,
          transformedSecret: "hello",
        });

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.transformedSecret).toBe("hello");
      });
    });

    // ─── Update Operations ─────────────────────────────────────────────

    describe("update operations", () => {
      test("update encrypted field preserves new value", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "original",
          pin: 1,
          verified: false,
          metadata: {},
          optionalSecret: null,
          transformedSecret: "test",
        });

        const entity = await repo.findOneOrFail({ id: inserted.id });
        entity.secret = "updated-secret";
        await repo.update(entity);

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.secret).toBe("updated-secret");
      });

      test("save (insert-or-update) with encrypted fields round-trips correctly", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const saved = await repo.save({
          secret: "save-secret",
          pin: 42,
          verified: true,
          metadata: { saved: true },
          optionalSecret: "opt",
          transformedSecret: "world",
        });

        const found = await repo.findOneOrFail({ id: saved.id });
        expect(found.secret).toBe("save-secret");
        expect(found.pin).toBe(42);
        expect(found.verified).toBe(true);
        expect(found.metadata).toMatchSnapshot();
        expect(found.optionalSecret).toBe("opt");
        expect(found.transformedSecret).toBe("world");

        // Now save again (update path)
        found.secret = "updated-via-save";
        await repo.save(found);

        const found2 = await repo.findOneOrFail({ id: saved.id });
        expect(found2.secret).toBe("updated-via-save");
      });
    });

    // ─── Batch Operations ──────────────────────────────────────────────

    describe("batch operations", () => {
      test("batch insert with encrypted entities round-trips all values", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const items = [
          {
            secret: "batch-1",
            pin: 100,
            verified: true,
            metadata: { idx: 1 },
            optionalSecret: null,
            transformedSecret: "one",
          },
          {
            secret: "batch-2",
            pin: 200,
            verified: false,
            metadata: { idx: 2 },
            optionalSecret: "opt-2",
            transformedSecret: "two",
          },
          {
            secret: "batch-3",
            pin: 300,
            verified: true,
            metadata: { idx: 3 },
            optionalSecret: null,
            transformedSecret: "three",
          },
        ];

        const inserted = await repo.insert(items);

        // Encrypted fields can't be ordered (ciphertext), so fetch by id
        const results = await Promise.all(
          inserted.map((e) => repo.findOneOrFail({ id: e.id })),
        );

        // Sort by secret value to get deterministic order
        results.sort((a, b) => a.secret.localeCompare(b.secret));

        expect(results).toHaveLength(3);

        expect(results[0].secret).toBe("batch-1");
        expect(results[0].pin).toBe(100);
        expect(results[0].verified).toBe(true);
        expect(results[0].optionalSecret).toBeNull();
        expect(results[0].transformedSecret).toBe("one");

        expect(results[1].secret).toBe("batch-2");
        expect(results[1].pin).toBe(200);
        expect(results[1].verified).toBe(false);
        expect(results[1].optionalSecret).toBe("opt-2");
        expect(results[1].transformedSecret).toBe("two");

        expect(results[2].secret).toBe("batch-3");
        expect(results[2].pin).toBe(300);
        expect(results[2].verified).toBe(true);
        expect(results[2].optionalSecret).toBeNull();
        expect(results[2].transformedSecret).toBe("three");
      });
    });

    // ─── findMany with Encrypted Entities ──────────────────────────────

    describe("findMany decrypts all encrypted fields", () => {
      test("find returns all entities with correctly decrypted fields", async () => {
        const repo = getHandle().repository(TckEncrypted);

        await repo.insert({
          secret: "alpha",
          pin: 10,
          verified: true,
          metadata: { a: 1 },
          optionalSecret: null,
          transformedSecret: "aaa",
        });
        await repo.insert({
          secret: "beta",
          pin: 20,
          verified: false,
          metadata: { b: 2 },
          optionalSecret: "opt-b",
          transformedSecret: "bbb",
        });
        await repo.insert({
          secret: "gamma",
          pin: 30,
          verified: true,
          metadata: { c: 3 },
          optionalSecret: null,
          transformedSecret: "ccc",
        });

        const results = await repo.find({}, { order: { createdAt: "ASC" } });
        expect(results).toHaveLength(3);

        // Sort by secret (decrypted) for deterministic snapshot
        const sorted = [...results].sort((a, b) => a.secret.localeCompare(b.secret));
        const mapped = sorted.map((r) => ({
          secret: r.secret,
          pin: r.pin,
          verified: r.verified,
          metadata: r.metadata,
          optionalSecret: r.optionalSecret,
          transformedSecret: r.transformedSecret,
        }));

        expect(mapped).toMatchSnapshot();
      });
    });
  });
};
