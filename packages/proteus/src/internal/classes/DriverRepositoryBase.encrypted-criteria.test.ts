import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "../../classes/ProteusSource.js";
import {
  CreateDateField,
  DeleteDateField,
  Encrypted,
  Entity,
  ExpiryDateField,
  Field,
  Generated,
  Nullable,
  PrimaryKey,
  PrimaryKeyField,
  UpdateDateField,
  VersionEndDateField,
  VersionField,
  VersionKeyField,
  VersionStartDateField,
} from "../../decorators/index.js";
import type { IProteusRepository } from "../../interfaces/index.js";
import { createMockProteusVault } from "../../mocks/create-mock-proteus-vault.js";

/**
 * Every criteria-taking entry point on a repository must REFUSE criteria that
 * name an `@Encrypted` column.
 *
 * The column holds ciphertext sealed under a random IV, so the same plaintext
 * seals differently on every write and no value a caller could send would ever
 * match. Left unguarded, the query does not fail — it returns zero rows, which
 * is indistinguishable from a correct empty answer.
 *
 * These run against a REAL sqlite source with a REAL vault — a temp-file
 * database, no docker. The rows really are ciphertext at rest, so an assertion
 * here is about behaviour, not wiring. SQLite rather than memory because the
 * memory driver refuses GROUP BY / HAVING outright, which would leave the
 * `having` family of the enumeration below unexercised.
 */

// ─── Entities ─────────────────────────────────────────────────────────────────

// Carries a delete date AND an expiry date so `softDelete` / `restore` / `ttl`
// reach the criteria guard instead of tripping their entity-shape guard first.
@Entity({ name: "GuardCriteriaItem" })
class GuardCriteriaItem {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @DeleteDateField()
  deletedAt!: Date | null;

  @ExpiryDateField()
  expiresAt!: Date | null;

  @Field("string")
  name!: string;

  @Field("integer")
  quantity!: number;

  @Encrypted()
  @Field("string")
  sealed!: string;

  @Encrypted()
  @Field("integer")
  sealedAmount!: number;
}

// Temporal, so `versions()` gets past `guardVersionFields`.
@Entity({ name: "GuardCriteriaVersioned" })
class GuardCriteriaVersioned {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKeyField()
  @Generated("uuid")
  versionId!: string;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @VersionStartDateField()
  versionStart!: Date;

  @Nullable()
  @VersionEndDateField()
  versionEnd!: Date | null;

  @Field("string")
  name!: string;

  @Encrypted()
  @Field("string")
  sealed!: string;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let source: ProteusSource;
let repo: IProteusRepository<GuardCriteriaItem>;
let versionedRepo: IProteusRepository<GuardCriteriaVersioned>;

const filename = join(tmpdir(), `proteus-encrypted-criteria-${randomUUID()}.db`);

beforeAll(async () => {
  const logger = createMockLogger();
  // A REAL vault holding a real KEK — the rows below are genuinely sealed at
  // rest, so "the plaintext cannot match" is a fact here, not a stub.
  const { amphora, encryption } = createMockProteusVault(logger);

  source = new ProteusSource({
    driver: "sqlite",
    filename,
    entities: [GuardCriteriaItem, GuardCriteriaVersioned],
    logger,
    synchronize: true,
    amphora,
    encryption,
  });
  await source.connect();
  await source.setup();

  repo = source.repository(GuardCriteriaItem);
  versionedRepo = source.repository(GuardCriteriaVersioned);
});

afterAll(async () => {
  await source.disconnect();
  await rm(filename, { force: true });
});

beforeEach(async () => {
  await repo.clear();
  await versionedRepo.clear();
});

const seed = () =>
  repo.insert({ name: "alice", quantity: 3, sealed: "s3cr3t", sealedAmount: 42 });

const REFUSED = /Cannot filter on encrypted field "sealed"/;

// ─── The bug ──────────────────────────────────────────────────────────────────

describe("filtering on an @Encrypted column", () => {
  test("the plaintext is genuinely unmatchable — the row is there, the filter is not", async () => {
    const inserted = await seed();

    // The row exists and its plaintext round-trips.
    const all = await repo.find({});
    expect(all).toHaveLength(1);
    expect(all[0].sealed).toBe("s3cr3t");

    // An unencrypted column filters it fine.
    await expect(repo.find({ id: inserted.id })).resolves.toHaveLength(1);

    // The encrypted one is refused rather than silently matching nothing.
    await expect(repo.find({ sealed: "s3cr3t" })).rejects.toThrow(REFUSED);
  });

  test("the refusal names the digest-column way out", async () => {
    // The way out lives in `details`, which is what surfaces to an operator —
    // "unsupported" alone would leave a legitimate need with no route.
    await expect(repo.findOne({ sealed: "s3cr3t" })).rejects.toMatchObject({
      code: "unsupported_operation",
      details: expect.stringContaining(
        "store a deterministic derivative beside it — a digest column written on save",
      ),
    });
  });

  test("refuses at every depth of the logical tree", async () => {
    await seed();

    await expect(repo.find({ $and: [{ sealed: "s3cr3t" }] })).rejects.toThrow(REFUSED);
    await expect(repo.find({ $not: { sealed: "s3cr3t" } })).rejects.toThrow(REFUSED);
    await expect(
      repo.find({ $or: [{ name: "alice" }, { $not: { sealed: "s3cr3t" } }] }),
    ).rejects.toThrow(REFUSED);
  });

  test("refuses a field-level operator on an encrypted column", async () => {
    await expect(repo.find({ sealed: { $like: "s3%" } })).rejects.toThrow(REFUSED);
    await expect(repo.find({ sealed: { $in: ["s3cr3t"] } })).rejects.toThrow(REFUSED);
  });
});

// ─── The negative half ────────────────────────────────────────────────────────

describe("criteria that name no encrypted column still work", () => {
  test("plain and nested criteria over unencrypted columns", async () => {
    await seed();
    await repo.insert({ name: "bob", quantity: 9, sealed: "other", sealedAmount: 1 });

    await expect(repo.find({ name: "alice" })).resolves.toHaveLength(1);
    await expect(
      repo.find({ $or: [{ name: "alice" }, { quantity: { $gt: 5 } }] }),
    ).resolves.toHaveLength(2);
    await expect(repo.count({ $not: { name: "alice" } })).resolves.toBe(1);
  });

  test("an updateMany PAYLOAD may write an encrypted field — it re-encrypts on the way in", async () => {
    const inserted = await seed();

    await repo.updateMany({ id: inserted.id }, { sealed: "rotated" });

    const found = await repo.findOneOrFail({ id: inserted.id });
    expect(found.sealed).toBe("rotated");
  });

  test("only the updateMany CRITERIA is refused", async () => {
    await expect(
      repo.updateMany({ sealed: "s3cr3t" }, { name: "renamed" }),
    ).rejects.toThrow(REFUSED);
  });

  test("aggregates over an unencrypted field are unaffected", async () => {
    await seed();
    await repo.insert({ name: "bob", quantity: 9, sealed: "other", sealedAmount: 1 });

    await expect(repo.sum("quantity")).resolves.toBe(12);
    await expect(repo.maximum("quantity", { name: "alice" })).resolves.toBe(3);
  });
});

// ─── Aggregates: the FIELD guard, separate from the criteria walk ─────────────

describe("aggregates over an @Encrypted field", () => {
  test.each(["sum", "average", "minimum", "maximum"] as const)(
    "%s refuses an encrypted field",
    async (method) => {
      await seed();

      await expect(repo[method]("sealedAmount")).rejects.toThrow(
        new RegExp(`Cannot ${method} encrypted field "sealedAmount"`),
      );
    },
  );

  test.each(["sum", "average", "minimum", "maximum"] as const)(
    "%s refuses encrypted criteria even over an unencrypted field",
    async (method) => {
      await seed();

      await expect(repo[method]("quantity", { sealed: "s3cr3t" })).rejects.toThrow(
        REFUSED,
      );
    },
  );
});

// ─── The enumeration ──────────────────────────────────────────────────────────

/**
 * Every method on `IProteusRepository` that accepts a `Condition`, exercised
 * against a real repository.
 *
 * ⚠ What this does NOT catch: a criteria-taking method added to the repository
 * LATER without a guard. Nothing enumerates the interface at runtime, so a new
 * method simply will not appear in this list. Adding one means adding its row
 * here by hand.
 *
 * `deleteExpired()` and `clear()` take no criteria and are deliberately absent.
 */
describe("every criteria-taking entry point refuses an encrypted column", () => {
  const criteria = { sealed: "s3cr3t" } as const;

  const entryPoints: Array<[string, () => Promise<unknown>]> = [
    ["count", () => repo.count(criteria)],
    ["exists", () => repo.exists(criteria)],
    ["find", () => repo.find(criteria)],
    ["findAndCount", () => repo.findAndCount(criteria)],
    ["findOne", () => repo.findOne(criteria)],
    ["findOneOrFail", () => repo.findOneOrFail(criteria)],
    [
      "findOneOrSave",
      () =>
        repo.findOneOrSave(criteria, {
          name: "x",
          quantity: 1,
          sealed: "y",
          sealedAmount: 1,
        }),
    ],
    ["findPaginated", () => repo.findPaginated(criteria)],
    [
      "paginate",
      () => repo.paginate(criteria, { first: 10, orderBy: { createdAt: "ASC" } }),
    ],
    ["increment", () => repo.increment(criteria, "quantity", 1)],
    ["decrement", () => repo.decrement(criteria, "quantity", 1)],
    ["delete", () => repo.delete(criteria)],
    ["updateMany", () => repo.updateMany(criteria, { name: "x" })],
    ["softDelete", () => repo.softDelete(criteria)],
    ["restore", () => repo.restore(criteria)],
    ["ttl", () => repo.ttl(criteria)],
    ["sum", () => repo.sum("quantity", criteria)],
    ["average", () => repo.average("quantity", criteria)],
    ["minimum", () => repo.minimum("quantity", criteria)],
    ["maximum", () => repo.maximum("quantity", criteria)],
    ["cursor", () => repo.cursor({ where: criteria })],
    [
      "stream",
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of repo.stream({ where: criteria })) break;
      },
    ],
    ["versions", () => versionedRepo.versions({ sealed: "s3cr3t" })],
    ["queryBuilder().where", () => repo.queryBuilder().where(criteria).getMany()],
    [
      "queryBuilder().andWhere",
      () => repo.queryBuilder().where({ name: "x" }).andWhere(criteria).getMany(),
    ],
    [
      "queryBuilder().orWhere",
      () => repo.queryBuilder().where({ name: "x" }).orWhere(criteria).getMany(),
    ],
    [
      "queryBuilder().having",
      () => repo.queryBuilder().groupBy("name").having(criteria).getMany(),
    ],
    [
      "queryBuilder().andHaving",
      () =>
        repo
          .queryBuilder()
          .groupBy("name")
          .having({ name: "x" })
          .andHaving(criteria)
          .getMany(),
    ],
    [
      "queryBuilder().orHaving",
      () =>
        repo
          .queryBuilder()
          .groupBy("name")
          .having({ name: "x" })
          .orHaving(criteria)
          .getMany(),
    ],
    [
      "queryBuilder().update().where",
      () => repo.queryBuilder().update().set({ name: "x" }).where(criteria).execute(),
    ],
    [
      "queryBuilder().delete().where",
      () => repo.queryBuilder().delete().where(criteria).execute(),
    ],
    [
      "queryBuilder().softDelete().where",
      () => repo.queryBuilder().softDelete().where(criteria).execute(),
    ],
  ];

  // Builder methods refuse SYNCHRONOUSLY (they return `this`, not a promise)
  // while repository methods reject — `Promise.resolve().then(call)` normalises
  // the two so one assertion covers both.
  test.each(entryPoints)("%s", async (_name, call) => {
    await expect(Promise.resolve().then(call)).rejects.toThrow(REFUSED);
  });
});
