import { ProteusError } from "../../../../errors";
import { makeField } from "../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type { PostgresQueryClient } from "../types/postgres-query-client";
import { PostgresQueryBuilder } from "./PostgresQueryBuilder";
import { describe, expect, test, vi } from "vitest";

const metadata = {
  appendOnly: false,
  cache: null,
  defaultOrder: null,
  embeddedLists: [],
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
  ],
  relations: [],
  relationCounts: [],
  relationIds: [],
  primaryKeys: ["id"],
  generated: [],
  hooks: [],
  inheritance: null,
  indexes: [],
  checks: [],
  extras: [],
  filters: [],
  schemas: [],
  scopeKeys: [],
  uniques: [],
  versionKeys: [],
  target: class {} as any,
} as EntityMetadata;

const createMockClient = (rows: Array<any> = []): PostgresQueryClient => ({
  query: vi.fn(async () => ({ rows, rowCount: rows.length })),
});

describe("PostgresQueryBuilder", () => {
  describe("toSQL", () => {
    test("should return compiled query", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.where({ name: "Alice" });
      expect(qb.toSQL()).toMatchSnapshot();
    });

    test("should include lock mode", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.where({ name: "Alice" }).lock("pessimistic_write");
      const sql = qb.toSQL();
      expect(sql.text).toContain("FOR UPDATE");
    });
  });

  describe("toQuery", () => {
    test("should return same as toSQL", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.where({ name: "Alice" });
      expect(qb.toQuery()).toEqual(qb.toSQL());
    });
  });

  describe("getMany", () => {
    test("should execute query and hydrate results", async () => {
      const client = createMockClient([
        { t0_id: "1", t0_name: "Alice", t0_email: "alice@test.com", t0_age: 25 },
        { t0_id: "2", t0_name: "Bob", t0_email: "bob@test.com", t0_age: 30 },
      ]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.getMany();

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(result).toMatchSnapshot();
    });

    test("should return empty array for no rows", async () => {
      const client = createMockClient([]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.getMany();
      expect(result).toEqual([]);
    });
  });

  describe("getOne", () => {
    test("should return single entity", async () => {
      const client = createMockClient([
        { t0_id: "1", t0_name: "Alice", t0_email: "alice@test.com", t0_age: 25 },
      ]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.where({ name: "Alice" }).getOne();

      expect(result).toMatchSnapshot();
    });

    test("should return null for no rows", async () => {
      const client = createMockClient([]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.where({ name: "Nobody" }).getOne();
      expect(result).toBeNull();
    });
  });

  describe("getOneOrFail", () => {
    test("should return entity when found", async () => {
      const client = createMockClient([
        { t0_id: "1", t0_name: "Alice", t0_email: "alice@test.com", t0_age: 25 },
      ]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.getOneOrFail();
      expect(result).toBeDefined();
    });

    test("should throw when not found", async () => {
      const client = createMockClient([]);
      const qb = new PostgresQueryBuilder(metadata, client);
      await expect(qb.getOneOrFail()).rejects.toThrow(ProteusError);
      await expect(qb.getOneOrFail()).rejects.toThrow(
        /Expected entity "users" not found/,
      );
    });
  });

  describe("count", () => {
    test("should return count", async () => {
      const client = createMockClient([{ count: "42" }]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.count();
      expect(result).toBe(42);
    });

    test("should return 0 for no rows", async () => {
      const client = createMockClient([]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.count();
      expect(result).toBe(0);
    });
  });

  describe("exists", () => {
    test("should return true when count > 0", async () => {
      const client = createMockClient([{ count: "1" }]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.where({ name: "Alice" }).exists();
      expect(result).toBe(true);
    });

    test("should return false when count is 0", async () => {
      const client = createMockClient([{ count: "0" }]);
      const qb = new PostgresQueryBuilder(metadata, client);
      const result = await qb.where({ name: "Nobody" }).exists();
      expect(result).toBe(false);
    });
  });

  describe("getManyAndCount", () => {
    test("should return entities and count", async () => {
      const queryFn = vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ t0_id: "1", t0_name: "Alice", t0_email: "a@t.com", t0_age: 25 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ count: "5" }],
          rowCount: 1,
        });

      const client: PostgresQueryClient = { query: queryFn };
      const qb = new PostgresQueryBuilder(metadata, client);
      const [entities, count] = await qb.getManyAndCount();

      expect(entities).toHaveLength(1);
      expect(count).toBe(5);
    });
  });

  describe("subquery predicate reset semantics", () => {
    // Each of whereInQuery / whereNotInQuery / whereExists / whereNotExists has
    // "reset" semantics — calling them discards any previously-pushed subquery
    // predicates, just as .where() discards previously-pushed regular predicates.
    // These tests verify that invariant for the non-IN variants.

    const subMetadata = {
      appendOnly: false,
      cache: null,
      defaultOrder: null,
      embeddedLists: [],
      entity: {
        decorator: "Entity",
        cache: null,
        comment: null,
        database: null,
        name: "posts",
        namespace: "app",
      },
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("userId", { type: "uuid", name: "user_id" }),
      ],
      relations: [],
      relationCounts: [],
      relationIds: [],
      primaryKeys: ["id"],
      generated: [],
      hooks: [],
      inheritance: null,
      indexes: [],
      checks: [],
      extras: [],
      filters: [],
      schemas: [],
      scopeKeys: [],
      uniques: [],
      versionKeys: [],
      target: class {} as any,
    } as EntityMetadata;

    test("whereNotInQuery resets subqueryPredicates pushed by a prior whereInQuery call", () => {
      const client = createMockClient();
      const subClient = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      const subQb = new PostgresQueryBuilder(subMetadata, subClient);

      // Seed a subquery predicate via whereInQuery
      qb.whereInQuery("id", subQb, "userId");
      expect((qb as any).state.subqueryPredicates).toHaveLength(1);

      // whereNotInQuery must reset before pushing its own entry
      qb.whereNotInQuery("id", subQb, "userId");
      expect((qb as any).state.subqueryPredicates).toHaveLength(1);
      expect((qb as any).state.subqueryPredicates[0].type).toBe("nin");
    });

    test("whereExists resets subqueryPredicates pushed by a prior whereInQuery call", () => {
      const client = createMockClient();
      const subClient = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      const subQb = new PostgresQueryBuilder(subMetadata, subClient);

      qb.whereInQuery("id", subQb, "userId");
      expect((qb as any).state.subqueryPredicates).toHaveLength(1);

      qb.whereExists(subQb);
      expect((qb as any).state.subqueryPredicates).toHaveLength(1);
      expect((qb as any).state.subqueryPredicates[0].type).toBe("exists");
    });

    test("whereNotExists resets subqueryPredicates pushed by a prior whereInQuery call", () => {
      const client = createMockClient();
      const subClient = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      const subQb = new PostgresQueryBuilder(subMetadata, subClient);

      qb.whereInQuery("id", subQb, "userId");
      expect((qb as any).state.subqueryPredicates).toHaveLength(1);

      qb.whereNotExists(subQb);
      expect((qb as any).state.subqueryPredicates).toHaveLength(1);
      expect((qb as any).state.subqueryPredicates[0].type).toBe("notExists");
    });
  });

  describe("clone", () => {
    test("should create independent copy", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.where({ name: "Alice" }).lock("pessimistic_write");

      const cloned = qb.clone() as PostgresQueryBuilder<any>;
      qb.where({ name: "Changed" });

      // Values are parameterized, check params array
      expect(cloned.toSQL().params).toEqual(["Alice"]);
      expect(cloned.toSQL().text).toContain("FOR UPDATE");
      // Original was changed, clone was not
      expect(qb.toSQL().params).toEqual(["Changed"]);
    });
  });

  describe("lock", () => {
    test("should append lock clause to SQL", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.lock("pessimistic_read");
      const sql = qb.toSQL();
      expect(sql.text).toContain("FOR SHARE");
    });

    test("should compile extended lock modes via generic lock()", () => {
      const client = createMockClient();

      const qb1 = new PostgresQueryBuilder(metadata, client);
      qb1.lock("pessimistic_write_skip");
      expect(qb1.toSQL().text).toContain("FOR UPDATE SKIP LOCKED");

      const qb2 = new PostgresQueryBuilder(metadata, client);
      qb2.lock("pessimistic_write_fail");
      expect(qb2.toSQL().text).toContain("FOR UPDATE NOWAIT");

      const qb3 = new PostgresQueryBuilder(metadata, client);
      qb3.lock("pessimistic_read_skip");
      expect(qb3.toSQL().text).toContain("FOR SHARE SKIP LOCKED");

      const qb4 = new PostgresQueryBuilder(metadata, client);
      qb4.lock("pessimistic_read_fail");
      expect(qb4.toSQL().text).toContain("FOR SHARE NOWAIT");
    });
  });

  describe("convenience lock methods", () => {
    test("forUpdate should compile FOR UPDATE", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.forUpdate();
      expect(qb.toSQL().text).toContain("FOR UPDATE");
    });

    test("forShare should compile FOR SHARE", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.forShare();
      expect(qb.toSQL().text).toContain("FOR SHARE");
    });

    test("forUpdateSkipLocked should compile FOR UPDATE SKIP LOCKED", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.forUpdateSkipLocked();
      expect(qb.toSQL().text).toContain("FOR UPDATE SKIP LOCKED");
    });

    test("forUpdateNoWait should compile FOR UPDATE NOWAIT", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.forUpdateNoWait();
      expect(qb.toSQL().text).toContain("FOR UPDATE NOWAIT");
    });

    test("forShareSkipLocked should compile FOR SHARE SKIP LOCKED", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.forShareSkipLocked();
      expect(qb.toSQL().text).toContain("FOR SHARE SKIP LOCKED");
    });

    test("forShareNoWait should compile FOR SHARE NOWAIT", () => {
      const client = createMockClient();
      const qb = new PostgresQueryBuilder(metadata, client);
      qb.forShareNoWait();
      expect(qb.toSQL().text).toContain("FOR SHARE NOWAIT");
    });
  });
});
