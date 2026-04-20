import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  CreateDateField,
  Entity,
  Field,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "../../../../decorators";
import { ProteusSource } from "../../../../classes/ProteusSource";
import { MemoryDriverError } from "../errors/MemoryDriverError";
import type { IProteusRepository } from "../../../../interfaces";

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity({ name: "DriverTestUser" })
class DriverTestUser {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;
}

@Entity({ name: "DriverTestRole" })
class DriverTestRole {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  title!: string;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let source: ProteusSource;
let userRepo: IProteusRepository<DriverTestUser>;

beforeAll(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [DriverTestUser, DriverTestRole],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();

  userRepo = source.repository(DriverTestUser);
});

afterAll(async () => {
  await source.disconnect();
});

beforeEach(async () => {
  await userRepo.clear();
});

// ─── connect / ping / disconnect ──────────────────────────────────────────────

describe("MemoryDriver.connect / ping / disconnect", () => {
  test("connect resolves without error", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await expect(s.connect()).resolves.toBeUndefined();
    await s.disconnect();
  });

  test("ping returns true", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await s.connect();
    await expect(s.ping()).resolves.toBe(true);
    await s.disconnect();
  });

  test("disconnect clears all store data", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await s.connect();
    await s.setup();

    const repo = s.repository(DriverTestUser);
    await repo.insert(repo.create({ name: "Alice" }));

    const before = await repo.find();
    expect(before).toHaveLength(1);

    await s.disconnect();

    // Re-connect and setup to allow further queries
    await s.connect();
    await s.setup();

    const after = await s.repository(DriverTestUser).find();
    expect(after).toHaveLength(0);
    await s.disconnect();
  });
});

// ─── setup ────────────────────────────────────────────────────────────────────

describe("MemoryDriver.setup", () => {
  test("creates table entries for each entity", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await s.connect();
    await s.setup();

    // Can insert and find without error
    const repo = s.repository(DriverTestUser);
    await repo.insert(repo.create({ name: "Test" }));
    const results = await repo.find();
    expect(results).toHaveLength(1);

    await s.disconnect();
  });

  test("creates join tables for ManyToMany relations", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser, DriverTestRole],
      logger: createMockLogger(),
    });
    await s.connect();
    await s.setup();

    // Calling setup twice should not throw (idempotent)
    await expect(s.setup()).resolves.toBeUndefined();
    await s.disconnect();
  });
});

// ─── createRepository ─────────────────────────────────────────────────────────

describe("MemoryDriver.createRepository", () => {
  test("returns a functioning repository", async () => {
    const repo = source.repository(DriverTestUser);

    const user = repo.create({ name: "Repo Test" });
    const inserted = await repo.insert(user);

    expect(inserted).toMatchSnapshot({
      id: expect.any(String),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });
});

// ─── acquireClient ────────────────────────────────────────────────────────────

describe("MemoryDriver.acquireClient", () => {
  test("throws MemoryDriverError because memory driver has no client", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await s.connect();

    await expect(s.client()).rejects.toThrow(MemoryDriverError);
    await s.disconnect();
  });
});

// ─── transactions ─────────────────────────────────────────────────────────────

describe("MemoryDriver.beginTransaction / commitTransaction / rollbackTransaction", () => {
  test("commit applies changes to main store", async () => {
    await source.transaction(async (ctx) => {
      const txRepo = ctx.repository(DriverTestUser);
      await txRepo.insert(txRepo.create({ name: "Committed" }));
    });

    const results = await userRepo.find();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Committed");
  });

  test("rollback discards changes", async () => {
    await expect(
      source.transaction(async (ctx) => {
        const txRepo = ctx.repository(DriverTestUser);
        await txRepo.insert(txRepo.create({ name: "Will be rolled back" }));
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const results = await userRepo.find();
    expect(results).toHaveLength(0);
  });

  test("cannot commit a transaction that was already committed", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await s.connect();
    await s.setup();

    // Expose driver to call low-level methods
    const driver = (s as any)._driver;
    const handle = await driver.beginTransaction();
    await driver.commitTransaction(handle);

    await expect(driver.commitTransaction(handle)).rejects.toThrow(MemoryDriverError);
    await s.disconnect();
  });

  test("cannot rollback a transaction that was already rolled back", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await s.connect();
    await s.setup();

    const driver = (s as any)._driver;
    const handle = await driver.beginTransaction();
    await driver.rollbackTransaction(handle);

    await expect(driver.rollbackTransaction(handle)).rejects.toThrow(MemoryDriverError);
    await s.disconnect();
  });
});

// ─── cloneWithGetters ─────────────────────────────────────────────────────────

describe("MemoryDriver.cloneWithGetters", () => {
  test("cloned driver shares the same in-memory store", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await s.connect();
    await s.setup();

    const repo = s.repository(DriverTestUser);
    await repo.insert(repo.create({ name: "Shared" }));

    // Clone the source — clones share store
    const cloned = s.session();
    const clonedRepo = cloned.repository(DriverTestUser);
    const results = await clonedRepo.find();

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Shared");

    await s.disconnect();
  });
});

// ─── createQueryBuilder ───────────────────────────────────────────────────────

describe("MemoryDriver.createQueryBuilder", () => {
  test("returns a working query builder", async () => {
    await userRepo.insert(userRepo.create({ name: "QB User" }));

    const qb = source.queryBuilder(DriverTestUser);
    const results = await qb.getMany();

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("QB User");
  });

  test("transactional query builder uses transaction store", async () => {
    const s = new ProteusSource({
      driver: "memory",
      entities: [DriverTestUser],
      logger: createMockLogger(),
    });
    await s.connect();
    await s.setup();

    let qbResult: DriverTestUser[] = [];

    await s.transaction(async (ctx) => {
      const txRepo = ctx.repository(DriverTestUser);
      await txRepo.insert(txRepo.create({ name: "InTx" }));

      const qb = ctx.queryBuilder(DriverTestUser);
      qbResult = await qb.getMany();
    });

    expect(qbResult).toHaveLength(1);
    expect(qbResult[0].name).toBe("InTx");
    await s.disconnect();
  });
});
