import { describe, test, expect, beforeEach, vi } from "vitest";
// TCK: Encryption Suite
// Tests field-level encryption via @Encrypted decorator across all drivers.

import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";
import { TCK_INTENDED_KEK, TCK_STAGED_KEK, TCK_TRAP_KEK } from "./create-tck-amphora.js";

export const encryptionSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Encryption", () => {
    const { TckEncrypted, TckStagedEncrypted } = entities;

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

      test("seals every field with the intended KEK, not the newer trap key", async () => {
        // The honesty test. The vault holds TWO enc-capable keys: the intended
        // `purpose: "proteus:tck"` KEK the source-level default names, and a
        // newer trap under a different purpose. Both seal AND unseal a value, so
        // a round-trip alone cannot tell a correct selection from a wrong one —
        // the trap decrypts its own ciphertext just fine. Proteus resolves a KEK
        // per @Encrypted field via `findSync`; the id it returns is the kid
        // AesKit embeds in the column. Spying on the vault the source encrypts
        // through proves every field was sealed with the intended KEK. If
        // selection ever stops scoping by the condition, the newer trap wins and
        // this goes RED, while the plain round-trips stay green.
        const handle = getHandle();
        const repo = handle.repository(TckEncrypted);

        const findSpy = vi.spyOn(handle.amphora, "findSync");

        const inserted = await repo.insert({
          secret: "kek-selection",
          pin: 4321,
          verified: true,
          metadata: { k: "v" },
          optionalSecret: "opt",
          transformedSecret: "hello",
        });

        expect(findSpy).toHaveBeenCalled();
        const selectedIds = findSpy.mock.results
          .filter((r) => r.type === "return")
          .map((r) => (r.value as { id: string }).id);

        expect(selectedIds.length).toBeGreaterThan(0);
        for (const id of selectedIds) {
          expect(id).toBe(TCK_INTENDED_KEK.id);
          expect(id).not.toBe(TCK_TRAP_KEK.id);
        }

        findSpy.mockRestore();

        // And the plaintext still round-trips.
        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.secret).toBe("kek-selection");
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

    // ─── Per-source Staged @Encrypted Selector ─────────────────────────
    // Proves `source.stageFieldDecorator(TckStagedEncrypted, "stagedSecret",
    // Encrypted, { condition: { purpose: "proteus:tck:staged" } })` — wired into
    // every driver harness BEFORE setup() — OVERRIDES the source-level encryption
    // default per field, at rest. `stagedSecret` must seal with the STAGED KEK;
    // its bare sibling `defaultSecret` must keep sealing with the source-default
    // intended KEK. If staging were ignored, `stagedSecret` would seal with the
    // intended KEK and this goes RED, while every round-trip stays green.

    describe("per-source staged @Encrypted selector (stageFieldDecorator)", () => {
      test("stages one field to a distinct KEK at rest while its sibling keeps the source default", async () => {
        const handle = getHandle();
        const repo = handle.repository(TckStagedEncrypted);

        // The vault query `resolveEncryptionKey` builds folds the field's selector
        // in as `query.purpose`, and the key `findSync` returns is the kid AesKit
        // embeds in that column at rest (see the trap-key honesty test). Spying on
        // the exact vault the source encrypts through lets us tie each field's
        // selector to the KEK id that actually sealed it.
        const findSpy = vi.spyOn(handle.amphora, "findSync");

        const inserted = await repo.insert({
          stagedSecret: "sealed-with-staged-kek",
          defaultSecret: "sealed-with-default-kek",
        });

        expect(findSpy).toHaveBeenCalled();
        const selections = findSpy.mock.calls
          .map((call, i) => ({
            purpose: (call[0] as { purpose?: string }).purpose,
            result: findSpy.mock.results[i],
          }))
          .filter((s) => s.result.type === "return")
          .map((s) => ({
            purpose: s.purpose,
            id: (s.result.value as { id: string }).id,
          }));

        const staged = selections.filter((s) => s.purpose === "proteus:tck:staged");
        const dflt = selections.filter((s) => s.purpose === "proteus:tck");

        // The STAGED field sealed with the STAGED KEK — the staged selector won
        // over the source default. Had staging been ignored, no query would carry
        // the staged purpose and this selection would be the intended KEK instead.
        expect(staged.length).toBeGreaterThan(0);
        for (const s of staged) {
          expect(s.id).toBe(TCK_STAGED_KEK.id);
          expect(s.id).not.toBe(TCK_INTENDED_KEK.id);
        }

        // The UNSTAGED sibling still sealed with the source-default intended KEK —
        // staging is per-field, not a source-wide switch.
        expect(dflt.length).toBeGreaterThan(0);
        for (const d of dflt) {
          expect(d.id).toBe(TCK_INTENDED_KEK.id);
          expect(d.id).not.toBe(TCK_STAGED_KEK.id);
        }

        // The trap never sealed anything.
        for (const s of selections) {
          expect(s.id).not.toBe(TCK_TRAP_KEK.id);
        }

        findSpy.mockRestore();

        // Both fields round-trip their plaintext regardless of which KEK sealed
        // them — a round-trip alone can't tell staged from default apart, which
        // is exactly why the id assertions above carry the honesty.
        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.stagedSecret).toBe("sealed-with-staged-kek");
        expect(found.defaultSecret).toBe("sealed-with-default-kek");
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

    // ─── Increment / Decrement Rejection ───────────────────────────────
    // Encrypted fields are stored as ciphertext; in-place arithmetic is
    // nonsensical. The guard lives in DriverRepositoryBase so EVERY driver
    // (memory + SQL) rejects symmetrically before any driver SQL is emitted.

    describe("increment/decrement of an encrypted field is rejected", () => {
      test("increment of an encrypted numeric field throws ProteusRepositoryError", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "s",
          pin: 1000,
          verified: false,
          metadata: {},
          optionalSecret: null,
          transformedSecret: "test",
        });

        await expect(repo.increment({ id: inserted.id }, "pin", 1)).rejects.toThrow(
          ProteusRepositoryError,
        );

        // The ciphertext value is untouched — no partial mutation occurred.
        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.pin).toBe(1000);
      });

      test("decrement of an encrypted numeric field throws ProteusRepositoryError", async () => {
        const repo = getHandle().repository(TckEncrypted);
        const inserted = await repo.insert({
          secret: "s",
          pin: 1000,
          verified: false,
          metadata: {},
          optionalSecret: null,
          transformedSecret: "test",
        });

        await expect(repo.decrement({ id: inserted.id }, "pin", 1)).rejects.toThrow(
          ProteusRepositoryError,
        );

        const found = await repo.findOneOrFail({ id: inserted.id });
        expect(found.pin).toBe(1000);
      });
    });
  });
};
