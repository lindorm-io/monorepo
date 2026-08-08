import { describe, expect, test } from "vitest";
import { DriverRepositoryBase } from "./DriverRepositoryBase.js";
import { MemoryRepository } from "../drivers/memory/classes/MemoryRepository.js";
import { MongoRepository } from "../drivers/mongo/classes/MongoRepository.js";
import { MySqlRepository } from "../drivers/mysql/classes/MySqlRepository.js";
import { PostgresRepository } from "../drivers/postgres/classes/PostgresRepository.js";
import { RedisRepository } from "../drivers/redis/classes/RedisRepository.js";
import { SqliteRepository } from "../drivers/sqlite/classes/SqliteRepository.js";

/**
 * A guard on a public repository method only holds while every driver inherits
 * that method. Three SQL drivers once overrode `delete`, `updateMany`,
 * `softDelete` and `restore` to wrap driver errors, restating the guards by
 * hand — and dropped `guardAppendOnly` from all twelve, so an @AppendOnly
 * entity could be bulk-deleted and bulk-updated on exactly those drivers.
 *
 * The behavioural proof is the append-only TCK, run on all six drivers. This
 * test guards the SHAPE instead: a driver that needs to reshape one of these
 * calls overrides the protected `perform*` hook, which cannot drop a guard
 * because it never mentions one. Overriding the public method again would be
 * the same mistake, whether or not the guards happened to be copied correctly
 * that time — so it fails here rather than waiting for a guard to go missing.
 */

// Concrete public methods on the base whose body starts with one or more
// guards. `clear`, `find`, `versions` and `cursor` are ABSTRACT — each driver
// writes its own body and its own guards, so they cannot be on this list.
const GUARDED_PUBLIC_METHODS = [
  "count",
  "decrement",
  "delete",
  "deleteExpired",
  "destroy",
  "exists",
  "findPaginated",
  "increment",
  "restore",
  "save",
  "softDelete",
  "softDestroy",
  "ttl",
  "update",
  "updateMany",
  "upsert",
] as const;

const DRIVER_REPOSITORIES = {
  MemoryRepository,
  MongoRepository,
  MySqlRepository,
  PostgresRepository,
  RedisRepository,
  SqliteRepository,
};

describe("driver repositories inherit every guarded public method", () => {
  test.each(Object.keys(DRIVER_REPOSITORIES))("%s", (name) => {
    const target = DRIVER_REPOSITORIES[name as keyof typeof DRIVER_REPOSITORIES];
    const own = Object.getOwnPropertyNames(target.prototype);
    const overridden = GUARDED_PUBLIC_METHODS.filter((method) => own.includes(method));

    expect(overridden).toEqual([]);
  });
});

describe("the guarded methods really are guarded on the base", () => {
  // Pins the list above to the base class: a name that stops existing there
  // fails, so the list cannot rot into a set of methods nobody has.
  test.each(GUARDED_PUBLIC_METHODS)("%s is a concrete base method", (method) => {
    expect(
      Object.getOwnPropertyNames(DriverRepositoryBase.prototype).includes(method),
    ).toBe(true);
  });
});
