import { ProteusError } from "../../../../errors/index.js";
import { makeField } from "../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { SqlFragment } from "../../../types/query.js";
import type { MysqlQueryClient } from "../types/mysql-query-client.js";
import { MySqlQueryBuilder } from "./MySqlQueryBuilder.js";
import { describe, expect, test, vi } from "vitest";

const fragment = (sql: string, params: Array<unknown> = []): SqlFragment =>
  ({ __brand: "SqlFragment", sql, params }) as SqlFragment;

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

const createMockClient = (rows: Array<any> = []): MysqlQueryClient => ({
  query: vi.fn(async () => ({ rows, rowCount: rows.length, insertId: 0 })),
});

describe("MySqlQueryBuilder", () => {
  describe("toSQL", () => {
    test("should return compiled query", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      qb.where({ name: "Alice" });
      expect(qb.toSQL()).toMatchSnapshot();
    });

    test("should include lock mode FOR UPDATE", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      qb.where({ name: "Alice" }).lock("pessimistic_write");
      const sql = qb.toSQL();
      expect(sql.text).toContain("FOR UPDATE");
    });

    test("should include lock mode FOR SHARE", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      qb.where({ name: "Alice" }).lock("pessimistic_read");
      const sql = qb.toSQL();
      expect(sql.text).toContain("FOR SHARE");
    });

    test("should include SKIP LOCKED", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      qb.where({ name: "Alice" }).forUpdateSkipLocked();
      const sql = qb.toSQL();
      expect(sql.text).toContain("FOR UPDATE SKIP LOCKED");
    });

    test("should include NOWAIT", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      qb.where({ name: "Alice" }).forUpdateNoWait();
      const sql = qb.toSQL();
      expect(sql.text).toContain("FOR UPDATE NOWAIT");
    });
  });

  describe("toQuery", () => {
    test("should return same as toSQL", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      qb.where({ name: "Alice" });
      expect(qb.toQuery()).toEqual(qb.toSQL());
    });
  });

  describe("getMany", () => {
    test("should execute query and hydrate results", async () => {
      const client = createMockClient([
        { t0_id: "1", t0_name: "Alice", t0_email_address: "alice@test.com", t0_age: 25 },
        { t0_id: "2", t0_name: "Bob", t0_email_address: "bob@test.com", t0_age: 30 },
      ]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.getMany();

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(result).toMatchSnapshot();
    });

    test("should return empty array for no rows", async () => {
      const client = createMockClient([]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.getMany();
      expect(result).toEqual([]);
    });
  });

  describe("getOne", () => {
    test("should return single entity", async () => {
      const client = createMockClient([
        { t0_id: "1", t0_name: "Alice", t0_email_address: "alice@test.com", t0_age: 25 },
      ]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.where({ name: "Alice" }).getOne();

      expect(result).toMatchSnapshot();
    });

    test("should return null for no rows", async () => {
      const client = createMockClient([]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.where({ name: "Nobody" }).getOne();
      expect(result).toBeNull();
    });
  });

  describe("getOneOrFail", () => {
    test("should return entity when found", async () => {
      const client = createMockClient([
        { t0_id: "1", t0_name: "Alice", t0_email_address: "alice@test.com", t0_age: 25 },
      ]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.getOneOrFail();
      expect(result).toBeDefined();
    });

    test("should throw when not found", async () => {
      const client = createMockClient([]);
      const qb = new MySqlQueryBuilder(metadata, client);
      await expect(qb.getOneOrFail()).rejects.toThrow(ProteusError);
      await expect(qb.getOneOrFail()).rejects.toThrow(
        /Expected entity "users" not found/,
      );
    });
  });

  describe("count", () => {
    test("should return count", async () => {
      const client = createMockClient([{ count: "42" }]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.count();
      expect(result).toBe(42);
    });

    test("should return 0 for no rows", async () => {
      const client = createMockClient([]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.count();
      expect(result).toBe(0);
    });
  });

  describe("exists", () => {
    test("should return true when count > 0", async () => {
      const client = createMockClient([{ count: "1" }]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.where({ name: "Alice" }).exists();
      expect(result).toBe(true);
    });

    test("should return false when count is 0", async () => {
      const client = createMockClient([{ count: "0" }]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.where({ name: "Nobody" }).exists();
      expect(result).toBe(false);
    });
  });

  describe("getManyAndCount", () => {
    test("should return entities and count", async () => {
      const queryFn = vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { t0_id: "1", t0_name: "Alice", t0_email_address: "a@t.com", t0_age: 25 },
          ],
          rowCount: 1,
          insertId: 0,
        })
        .mockResolvedValueOnce({
          rows: [{ count: "5" }],
          rowCount: 1,
          insertId: 0,
        });

      const client: MysqlQueryClient = { query: queryFn };
      const qb = new MySqlQueryBuilder(metadata, client);
      const [entities, count] = await qb.getManyAndCount();

      expect(entities).toHaveLength(1);
      expect(count).toBe(5);
    });
  });

  describe("subquery predicate reset semantics", () => {
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

    test("whereExists resets previous subquery predicates", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      const sub1 = new MySqlQueryBuilder(subMetadata, client);
      sub1.where({ userId: "x" });
      qb.whereExists(sub1);

      expect(qb.toSQL().text).toContain("EXISTS");

      // Second call should replace, not append
      const sub2 = new MySqlQueryBuilder(subMetadata, client);
      sub2.where({ userId: "y" });
      qb.whereExists(sub2);

      const compiled = qb.toSQL();
      // Should only have one EXISTS clause
      const existsCount = (compiled.text.match(/EXISTS/g) || []).length;
      expect(existsCount).toBe(1);
    });

    test("whereNotExists resets previous subquery predicates", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      const sub1 = new MySqlQueryBuilder(subMetadata, client);
      sub1.where({ userId: "x" });
      qb.whereNotExists(sub1);

      const sub2 = new MySqlQueryBuilder(subMetadata, client);
      sub2.where({ userId: "y" });
      qb.whereNotExists(sub2);

      const compiled = qb.toSQL();
      const existsCount = (compiled.text.match(/NOT EXISTS/g) || []).length;
      expect(existsCount).toBe(1);
    });
  });

  describe("clone", () => {
    test("should produce independent copy", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      qb.where({ name: "Alice" }).take(10);

      const cloned = qb.clone() as MySqlQueryBuilder<any>;
      cloned.where({ name: "Bob" });

      const originalSql = qb.toSQL();
      const clonedSql = cloned.toSQL();

      expect(originalSql.params).toContain("Alice");
      expect(clonedSql.params).toContain("Bob");
      expect(originalSql.params).not.toContain("Bob");
    });
  });

  describe("aggregate methods", () => {
    test("sum should return numeric result", async () => {
      const client = createMockClient([{ result: "100" }]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.sum("age" as any);
      expect(result).toBe(100);
    });

    test("average should return numeric result", async () => {
      const client = createMockClient([{ result: "25.5" }]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.average("age" as any);
      expect(result).toBe(25.5);
    });

    test("minimum should return null when no rows", async () => {
      const client = createMockClient([{ result: null }]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.minimum("age" as any);
      expect(result).toBeNull();
    });

    test("maximum should return numeric result", async () => {
      const client = createMockClient([{ result: "99" }]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.maximum("age" as any);
      expect(result).toBe(99);
    });
  });

  describe("CTE methods", () => {
    test("withCte should throw on duplicate name", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      qb.withCte("cte1", fragment("SELECT 1"));
      expect(() => qb.withCte("cte1", fragment("SELECT 2"))).toThrow(
        /CTE "cte1" already defined/,
      );
    });

    test("fromCte should throw if CTE not defined", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      expect(() => qb.fromCte("nonexistent")).toThrow(/CTE "nonexistent" not defined/);
    });
  });

  describe("getRawRows", () => {
    test("should return raw query results without hydration", async () => {
      const client = createMockClient([
        { t0_id: "1", t0_name: "Alice", t0_email_address: "alice@test.com", t0_age: 25 },
      ]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.getRawRows();

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(result).toMatchSnapshot();
    });

    test("should return empty array for no rows", async () => {
      const client = createMockClient([]);
      const qb = new MySqlQueryBuilder(metadata, client);
      const result = await qb.getRawRows();
      expect(result).toEqual([]);
    });
  });

  describe("whereInQuery / whereNotInQuery", () => {
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

    test("whereInQuery should compile IN (subquery)", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      const sub = new MySqlQueryBuilder(subMetadata, client);
      sub.where({ userId: "abc" });
      qb.whereInQuery("id", sub, "userId");

      const compiled = qb.toSQL();
      expect(compiled.text).toContain("IN");
      expect(compiled).toMatchSnapshot();
    });

    test("whereNotInQuery should compile NOT IN (subquery)", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      const sub = new MySqlQueryBuilder(subMetadata, client);
      sub.where({ userId: "abc" });
      qb.whereNotInQuery("id", sub, "userId");

      const compiled = qb.toSQL();
      expect(compiled.text).toContain("NOT IN");
      expect(compiled).toMatchSnapshot();
    });

    test("whereInQuery resets previous subquery predicates", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);

      const sub1 = new MySqlQueryBuilder(subMetadata, client);
      sub1.where({ userId: "x" });
      qb.whereInQuery("id", sub1, "userId");

      const sub2 = new MySqlQueryBuilder(subMetadata, client);
      sub2.where({ userId: "y" });
      qb.whereInQuery("id", sub2, "userId");

      const compiled = qb.toSQL();
      // Should only have one IN clause
      const inCount = (compiled.text.match(/\bIN\b/g) || []).length;
      expect(inCount).toBe(1);
    });
  });

  describe("set operations", () => {
    test("union should compile set operation", () => {
      const client = createMockClient();
      const qb1 = new MySqlQueryBuilder(metadata, client);
      qb1.where({ name: "Alice" });

      const qb2 = new MySqlQueryBuilder(metadata, client);
      qb2.where({ name: "Bob" });

      qb1.union(qb2);
      const compiled = qb1.toSQL();
      expect(compiled.text).toContain("UNION");
      expect(compiled).toMatchSnapshot();
    });

    test("intersect should compile INTERSECT set operation", () => {
      const client = createMockClient();
      const qb1 = new MySqlQueryBuilder(metadata, client);
      qb1.where({ name: "Alice" });

      const qb2 = new MySqlQueryBuilder(metadata, client);
      qb2.where({ age: { $gt: 20 } });

      qb1.intersect(qb2);
      const compiled = qb1.toSQL();
      expect(compiled.text).toContain("INTERSECT");
      expect(compiled).toMatchSnapshot();
    });

    test("except should compile EXCEPT set operation", () => {
      const client = createMockClient();
      const qb1 = new MySqlQueryBuilder(metadata, client);
      qb1.where({ name: "Alice" });

      const qb2 = new MySqlQueryBuilder(metadata, client);
      qb2.where({ age: { $lt: 18 } });

      qb1.except(qb2);
      const compiled = qb1.toSQL();
      expect(compiled.text).toContain("EXCEPT");
      expect(compiled).toMatchSnapshot();
    });

    test("should throw if secondary query has CTEs", () => {
      const client = createMockClient();
      const qb1 = new MySqlQueryBuilder(metadata, client);
      const qb2 = new MySqlQueryBuilder(metadata, client);
      qb2.withCte("cte1", fragment("SELECT 1"));

      expect(() => qb1.union(qb2)).toThrow(/Cannot use UNION/);
    });
  });

  describe("write builders", () => {
    test("insert() should return MySqlInsertQueryBuilder", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      const insertQb = qb.insert();
      expect(insertQb).toBeDefined();
      expect(insertQb.values).toBeDefined();
    });

    test("update() should return MySqlUpdateQueryBuilder", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      const updateQb = qb.update();
      expect(updateQb).toBeDefined();
      expect(updateQb.set).toBeDefined();
    });

    test("delete() should return MySqlDeleteQueryBuilder", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      const deleteQb = qb.delete();
      expect(deleteQb).toBeDefined();
      expect(deleteQb.where).toBeDefined();
    });

    test("softDelete() should return MySqlDeleteQueryBuilder", () => {
      const client = createMockClient();
      const qb = new MySqlQueryBuilder(metadata, client);
      const deleteQb = qb.softDelete();
      expect(deleteQb).toBeDefined();
      expect(deleteQb.where).toBeDefined();
    });
  });
});
