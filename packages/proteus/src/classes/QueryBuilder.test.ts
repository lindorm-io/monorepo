import { ProteusError } from "../errors/index.js";
import type { IEntity } from "../interfaces/index.js";
import type { EntityMetadata } from "../internal/entity/types/metadata.js";
import type { QueryState } from "../internal/types/query.js";
import { makeField } from "../internal/__fixtures__/make-field.js";
import { QueryBuilder } from "./QueryBuilder.js";
import { beforeEach, describe, expect, test } from "vitest";

// Concrete test implementation
class TestQueryBuilder<E extends IEntity> extends QueryBuilder<E> {
  public getState(): QueryState<E> {
    return this.state;
  }

  public exposeGuardAppendOnlyWrite(method: string): void {
    this.guardAppendOnlyWrite(method);
  }

  public clone(): TestQueryBuilder<E> {
    const cloned = new TestQueryBuilder<E>(this.metadata);
    cloned.state = this.cloneState();
    return cloned;
  }

  public toQuery(): unknown {
    return this.state;
  }

  public async getOne(): Promise<E | null> {
    return null;
  }
  public async getOneOrFail(): Promise<E> {
    throw new Error("not implemented");
  }
  public async getMany(): Promise<Array<E>> {
    return [];
  }
  public async getManyAndCount(): Promise<[Array<E>, number]> {
    return [[], 0];
  }
  public async count(): Promise<number> {
    return 0;
  }
  public async exists(): Promise<boolean> {
    return false;
  }
  public async getRawRows<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(): Promise<Array<T>> {
    return [];
  }
  public async sum(): Promise<number | null> {
    return null;
  }
  public async average(): Promise<number | null> {
    return null;
  }
  public async minimum(): Promise<number | null> {
    return null;
  }
  public async maximum(): Promise<number | null> {
    return null;
  }
  public insert(): any {
    return {};
  }
  public update(): any {
    return {};
  }
  public delete(): any {
    return {};
  }
  public softDelete(): any {
    return {};
  }
}

const makeMetadata = (overrides: Partial<EntityMetadata> = {}): EntityMetadata =>
  ({
    target: class {} as any,
    checks: [],
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "TestEntity",
      namespace: null,
    },
    extras: [],
    fields: [
      makeField("id", { type: "uuid", readonly: true }),
      makeField("name", { type: "string" }),
      makeField("email", { type: "string", nullable: true }),
      makeField("age", { type: "integer" }),
    ],
    generated: [],
    hooks: [],
    indexes: [],
    primaryKeys: ["id"],
    relations: [
      {
        key: "posts",
        foreignConstructor: () => class {} as any,
        foreignKey: "authorId",
        findKeys: { authorId: "id" },
        joinKeys: null,
        joinTable: null,
        options: {
          deferrable: false,
          initiallyDeferred: false,
          loading: { single: "lazy", multiple: "lazy" },
          nullable: false,
          onDestroy: "cascade",
          onInsert: "cascade",
          onOrphan: "ignore",
          onUpdate: "cascade",
          strategy: null,
        },
        type: "OneToMany",
      },
    ],
    schemas: [],
    uniques: [],
    versionKeys: [],
    ...overrides,
  }) as EntityMetadata;

describe("QueryBuilder", () => {
  let metadata: EntityMetadata;
  let qb: TestQueryBuilder<any>;

  beforeEach(() => {
    metadata = makeMetadata();
    qb = new TestQueryBuilder(metadata);
  });

  describe("where", () => {
    test("should set predicates", () => {
      qb.where({ name: "test" });
      expect(qb.getState().predicates).toMatchSnapshot();
    });

    test("should replace predicates on subsequent calls", () => {
      qb.where({ name: "first" });
      qb.where({ name: "second" });
      expect(qb.getState().predicates).toHaveLength(1);
      expect(qb.getState().predicates[0].predicate).toEqual({ name: "second" });
    });

    test("should reset subqueryPredicates", () => {
      // Seed a subquery predicate directly on state
      (qb.getState() as any).subqueryPredicates.push({
        type: "in",
        field: "id",
        sql: "SELECT id FROM other_table WHERE x = $1",
        params: ["abc"],
        conjunction: "and",
      });
      expect(qb.getState().subqueryPredicates).toHaveLength(1);

      qb.where({ name: "reset" });

      expect(qb.getState().subqueryPredicates).toEqual([]);
    });

    test("should reset rawWhere", () => {
      // Seed a raw where entry via the public API
      const fragment = { __brand: "SqlFragment" as const, sql: "age > $1", params: [18] };
      qb.whereRaw(fragment);
      expect(qb.getState().rawWhere).toHaveLength(1);

      qb.where({ name: "reset" });

      expect(qb.getState().rawWhere).toEqual([]);
    });
  });

  describe("andWhere", () => {
    test("should append with AND conjunction", () => {
      qb.where({ name: "test" });
      qb.andWhere({ age: { $gt: 18 } });
      expect(qb.getState().predicates).toMatchSnapshot();
    });
  });

  describe("orWhere", () => {
    test("should append with OR conjunction", () => {
      qb.where({ name: "test" });
      qb.orWhere({ email: { $exists: true } });
      expect(qb.getState().predicates).toMatchSnapshot();
    });
  });

  describe("include", () => {
    test("should add include spec with defaults", () => {
      qb.include("posts");
      expect(qb.getState().includes).toMatchSnapshot();
    });

    test("should add include spec with options", () => {
      qb.include("posts", { required: true, select: ["id", "title"] });
      expect(qb.getState().includes).toMatchSnapshot();
    });

    test("should add include spec with where predicate", () => {
      qb.include("posts", { where: { status: "published" } });
      expect(qb.getState().includes).toMatchSnapshot();
    });

    test("should add include spec with all options", () => {
      qb.include("posts", {
        required: true,
        select: ["id"],
        where: { status: { $in: ["published", "draft"] } },
      });
      expect(qb.getState().includes).toMatchSnapshot();
    });

    test("should throw on unknown relation", () => {
      expect(() => qb.include("nonexistent")).toThrow(ProteusError);
      expect(() => qb.include("nonexistent")).toThrow(/Unknown relation "nonexistent"/);
    });

    test("should throw on duplicate include", () => {
      qb.include("posts");
      expect(() => qb.include("posts")).toThrow(ProteusError);
      expect(() => qb.include("posts")).toThrow(/already included/);
    });
  });

  describe("select", () => {
    test("should set selections", () => {
      qb.select("id", "name");
      expect(qb.getState().selections).toEqual(["id", "name"]);
    });

    test("should throw on unknown field", () => {
      expect(() => qb.select("nonexistent" as any)).toThrow(ProteusError);
      expect(() => qb.select("nonexistent" as any)).toThrow(
        /Unknown field "nonexistent"/,
      );
    });
  });

  describe("orderBy", () => {
    test("should set orderBy", () => {
      qb.orderBy({ name: "ASC", age: "DESC" });
      expect(qb.getState().orderBy).toEqual({ name: "ASC", age: "DESC" });
    });

    test("should throw on unknown field", () => {
      expect(() => qb.orderBy({ nonexistent: "ASC" } as any)).toThrow(ProteusError);
    });
  });

  describe("skip and take", () => {
    test("should set skip", () => {
      qb.skip(10);
      expect(qb.getState().skip).toBe(10);
    });

    test("should set take", () => {
      qb.take(25);
      expect(qb.getState().take).toBe(25);
    });
  });

  describe("distinct", () => {
    test("should set distinct", () => {
      qb.distinct();
      expect(qb.getState().distinct).toBe(true);
    });
  });

  describe("withDeleted", () => {
    test("should set withDeleted", () => {
      qb.withDeleted();
      expect(qb.getState().withDeleted).toBe(true);
    });
  });

  describe("withoutScope", () => {
    test("should set withoutScope", () => {
      qb.withoutScope();
      expect(qb.getState().withoutScope).toBe(true);
    });

    test("should be chainable", () => {
      const result = qb.withoutScope();
      expect(result).toBe(qb);
    });
  });

  describe("setFilter", () => {
    test("should enable filter with true when no params provided", () => {
      qb.setFilter("tenant");
      expect(qb.getState().filterOverrides).toEqual({ tenant: true });
    });

    test("should enable filter with explicit true", () => {
      qb.setFilter("tenant", true);
      expect(qb.getState().filterOverrides).toEqual({ tenant: true });
    });

    test("should disable filter with false", () => {
      qb.setFilter("tenant", false);
      expect(qb.getState().filterOverrides).toEqual({ tenant: false });
    });

    test("should enable filter with param overrides", () => {
      qb.setFilter("tenant", { tenantId: "abc-123" });
      expect(qb.getState().filterOverrides).toEqual({ tenant: { tenantId: "abc-123" } });
    });

    test("should accumulate multiple filter overrides", () => {
      qb.setFilter("tenant", { tenantId: "abc" });
      qb.setFilter("region", { region: "us-east" });
      expect(qb.getState().filterOverrides).toEqual({
        tenant: { tenantId: "abc" },
        region: { region: "us-east" },
      });
    });

    test("should overwrite filter on repeated calls for same name", () => {
      qb.setFilter("tenant", { tenantId: "old" });
      qb.setFilter("tenant", { tenantId: "new" });
      expect(qb.getState().filterOverrides).toEqual({ tenant: { tenantId: "new" } });
    });

    test("should be chainable", () => {
      const result = qb.setFilter("tenant", true);
      expect(result).toBe(qb);
    });
  });

  describe("versionAt", () => {
    test("should set versionTimestamp", () => {
      const timestamp = new Date("2025-06-15T12:00:00Z");
      qb.versionAt(timestamp);
      expect(qb.getState().versionTimestamp).toBe(timestamp);
    });

    test("should be chainable", () => {
      const result = qb.versionAt(new Date());
      expect(result).toBe(qb);
    });
  });

  describe("clone", () => {
    test("should create independent copy", () => {
      qb.where({ name: "test" }).orderBy({ name: "ASC" }).skip(5).take(10);
      const cloned = qb.clone() as TestQueryBuilder<any>;

      // Modify original
      qb.where({ name: "changed" });

      // Clone should be unchanged
      expect(cloned.getState().predicates[0].predicate).toEqual({ name: "test" });
      expect(cloned.getState().orderBy).toEqual({ name: "ASC" });
      expect(cloned.getState().skip).toBe(5);
      expect(cloned.getState().take).toBe(10);
    });

    test("should preserve include where through clone", () => {
      qb.include("posts", { where: { status: "published" } });
      const cloned = qb.clone() as TestQueryBuilder<any>;
      expect(cloned.getState().includes[0].where).toEqual({ status: "published" });
    });

    test("should preserve versionTimestamp through clone", () => {
      const timestamp = new Date("2025-06-15T12:00:00Z");
      qb.versionAt(timestamp);
      const cloned = qb.clone() as TestQueryBuilder<any>;
      expect(cloned.getState().versionTimestamp).toBe(timestamp);
    });

    test("should preserve withAllVersions through clone", () => {
      (qb.getState() as any).withAllVersions = true;
      const cloned = qb.clone() as TestQueryBuilder<any>;
      expect(cloned.getState().withAllVersions).toBe(true);
    });

    test("should preserve withoutScope through clone", () => {
      qb.withoutScope();
      const cloned = qb.clone() as TestQueryBuilder<any>;
      expect(cloned.getState().withoutScope).toBe(true);
    });

    test("should deep copy filterOverrides through clone", () => {
      qb.setFilter("tenant", { tenantId: "abc" });
      const cloned = qb.clone() as TestQueryBuilder<any>;
      // Mutate original
      qb.setFilter("region", { region: "us" });
      expect(cloned.getState().filterOverrides).toEqual({ tenant: { tenantId: "abc" } });
      expect(qb.getState().filterOverrides).toEqual({
        tenant: { tenantId: "abc" },
        region: { region: "us" },
      });
    });
  });

  describe("chaining", () => {
    test("should support fluent chaining", () => {
      const result = qb
        .where({ name: "test" })
        .andWhere({ age: { $gte: 18 } })
        .include("posts")
        .select("id", "name")
        .orderBy({ name: "ASC" })
        .skip(0)
        .take(10)
        .distinct()
        .withDeleted();

      expect(result).toBe(qb);
      expect(qb.getState()).toMatchSnapshot();
    });
  });

  // --- Phase 12: Raw SQL methods ---

  describe("whereRaw", () => {
    test("should set rawWhere with AND conjunction", () => {
      const fragment = { __brand: "SqlFragment" as const, sql: "age > $1", params: [18] };
      qb.whereRaw(fragment);
      expect(qb.getState().rawWhere).toMatchSnapshot();
    });

    test("should replace rawWhere on subsequent calls", () => {
      const frag1 = { __brand: "SqlFragment" as const, sql: "a = $1", params: [1] };
      const frag2 = { __brand: "SqlFragment" as const, sql: "b = $1", params: [2] };
      qb.whereRaw(frag1);
      qb.whereRaw(frag2);
      expect(qb.getState().rawWhere).toHaveLength(1);
      expect(qb.getState().rawWhere[0].sql).toBe("b = $1");
    });
  });

  describe("andWhereRaw", () => {
    test("should append with AND conjunction", () => {
      const frag1 = { __brand: "SqlFragment" as const, sql: "a = $1", params: [1] };
      const frag2 = { __brand: "SqlFragment" as const, sql: "b = $1", params: [2] };
      qb.whereRaw(frag1);
      qb.andWhereRaw(frag2);
      expect(qb.getState().rawWhere).toHaveLength(2);
      expect(qb.getState().rawWhere[1].conjunction).toBe("and");
    });
  });

  describe("orWhereRaw", () => {
    test("should append with OR conjunction", () => {
      const frag1 = { __brand: "SqlFragment" as const, sql: "a = $1", params: [1] };
      const frag2 = { __brand: "SqlFragment" as const, sql: "b = $1", params: [2] };
      qb.whereRaw(frag1);
      qb.orWhereRaw(frag2);
      expect(qb.getState().rawWhere).toHaveLength(2);
      expect(qb.getState().rawWhere[1].conjunction).toBe("or");
    });
  });

  describe("selectRaw", () => {
    test("should add raw selection", () => {
      const fragment = { __brand: "SqlFragment" as const, sql: "COUNT(*)", params: [] };
      qb.selectRaw(fragment, "total");
      expect(qb.getState().rawSelections).toMatchSnapshot();
    });
  });

  // --- Phase 12: GROUP BY + HAVING ---

  describe("groupBy", () => {
    test("should set groupBy fields", () => {
      qb.groupBy("name", "age");
      expect(qb.getState().groupBy).toEqual(["name", "age"]);
    });

    test("should be chainable", () => {
      expect(qb.groupBy("name")).toBe(qb);
    });
  });

  describe("having", () => {
    test("should set having predicates", () => {
      qb.having({ age: { $gt: 18 } });
      expect(qb.getState().having).toMatchSnapshot();
    });

    test("should replace having on subsequent calls", () => {
      qb.having({ age: { $gt: 18 } });
      qb.having({ name: "test" });
      expect(qb.getState().having).toHaveLength(1);
    });
  });

  describe("andHaving", () => {
    test("should append with AND conjunction", () => {
      qb.having({ age: { $gt: 18 } });
      qb.andHaving({ name: "test" });
      expect(qb.getState().having).toHaveLength(2);
      expect(qb.getState().having[1].conjunction).toBe("and");
    });
  });

  describe("orHaving", () => {
    test("should append with OR conjunction", () => {
      qb.having({ age: { $gt: 18 } });
      qb.orHaving({ name: "test" });
      expect(qb.getState().having).toHaveLength(2);
      expect(qb.getState().having[1].conjunction).toBe("or");
    });
  });

  describe("havingRaw", () => {
    test("should set rawHaving", () => {
      const fragment = {
        __brand: "SqlFragment" as const,
        sql: "COUNT(*) > $1",
        params: [5],
      };
      qb.havingRaw(fragment);
      expect(qb.getState().rawHaving).toMatchSnapshot();
    });

    test("should replace rawHaving on subsequent calls", () => {
      const frag1 = { __brand: "SqlFragment" as const, sql: "a > $1", params: [1] };
      const frag2 = { __brand: "SqlFragment" as const, sql: "b > $1", params: [2] };
      qb.havingRaw(frag1);
      qb.havingRaw(frag2);
      expect(qb.getState().rawHaving).toHaveLength(1);
    });
  });

  describe("andHavingRaw", () => {
    test("should append with AND conjunction", () => {
      const frag1 = { __brand: "SqlFragment" as const, sql: "a > $1", params: [1] };
      const frag2 = { __brand: "SqlFragment" as const, sql: "b > $1", params: [2] };
      qb.havingRaw(frag1);
      qb.andHavingRaw(frag2);
      expect(qb.getState().rawHaving).toHaveLength(2);
      expect(qb.getState().rawHaving[1].conjunction).toBe("and");
    });
  });

  describe("orHavingRaw", () => {
    test("should append with OR conjunction", () => {
      const frag1 = { __brand: "SqlFragment" as const, sql: "a > $1", params: [1] };
      const frag2 = { __brand: "SqlFragment" as const, sql: "b > $1", params: [2] };
      qb.havingRaw(frag1);
      qb.orHavingRaw(frag2);
      expect(qb.getState().rawHaving).toHaveLength(2);
      expect(qb.getState().rawHaving[1].conjunction).toBe("or");
    });
  });

  // --- Phase 12: Window functions ---

  describe("window", () => {
    test("should add window spec", () => {
      qb.window({ fn: "ROW_NUMBER", orderBy: { name: "ASC" }, alias: "rn" });
      expect(qb.getState().windows).toMatchSnapshot();
    });

    test("should accumulate multiple windows", () => {
      qb.window({ fn: "ROW_NUMBER", orderBy: { name: "ASC" }, alias: "rn" });
      qb.window({
        fn: "RANK",
        partitionBy: ["age"],
        orderBy: { name: "DESC" },
        alias: "r",
      });
      expect(qb.getState().windows).toHaveLength(2);
    });

    test("should be chainable", () => {
      expect(qb.window({ fn: "COUNT", alias: "c" })).toBe(qb);
    });
  });

  // --- Phase 12: withAllVersions ---

  describe("withAllVersions", () => {
    test("should set withAllVersions to true", () => {
      qb.withAllVersions();
      expect(qb.getState().withAllVersions).toBe(true);
    });

    test("should be chainable", () => {
      expect(qb.withAllVersions()).toBe(qb);
    });
  });

  // --- guardAppendOnlyWrite ---

  describe("guardAppendOnlyWrite", () => {
    test("throws ProteusError when metadata.appendOnly is true", () => {
      const appendOnlyMetadata = makeMetadata({ appendOnly: true } as any);
      const appendOnlyQb = new TestQueryBuilder(appendOnlyMetadata);

      expect(() => appendOnlyQb.exposeGuardAppendOnlyWrite("update")).toThrow(
        ProteusError,
      );
    });

    test("error message includes entity name and method", () => {
      const appendOnlyMetadata = makeMetadata({ appendOnly: true } as any);
      const appendOnlyQb = new TestQueryBuilder(appendOnlyMetadata);

      expect(() => appendOnlyQb.exposeGuardAppendOnlyWrite("delete")).toThrow(
        /Cannot delete an append-only entity "TestEntity" via query builder/,
      );
    });

    test("does not throw when metadata.appendOnly is false", () => {
      expect(() => qb.exposeGuardAppendOnlyWrite("update")).not.toThrow();
    });

    test("does not throw when metadata.appendOnly is undefined", () => {
      const noAppendOnlyMeta = makeMetadata();
      const noAppendOnlyQb = new TestQueryBuilder(noAppendOnlyMeta);

      expect(() => noAppendOnlyQb.exposeGuardAppendOnlyWrite("update")).not.toThrow();
    });
  });

  // --- Clone preserves Phase 12 state ---

  describe("clone — Phase 12 state", () => {
    test("should deep copy rawWhere", () => {
      const fragment = { __brand: "SqlFragment" as const, sql: "a = $1", params: [1] };
      qb.whereRaw(fragment);
      const cloned = qb.clone() as TestQueryBuilder<any>;
      // Mutate original params
      qb.getState().rawWhere[0].params.push(2);
      expect(cloned.getState().rawWhere[0].params).toEqual([1]);
    });

    test("should deep copy groupBy", () => {
      qb.groupBy("name");
      const cloned = qb.clone() as TestQueryBuilder<any>;
      qb.groupBy("name", "age");
      expect(cloned.getState().groupBy).toEqual(["name"]);
    });

    test("should deep copy windows", () => {
      qb.window({ fn: "ROW_NUMBER", orderBy: { name: "ASC" }, alias: "rn" });
      const cloned = qb.clone() as TestQueryBuilder<any>;
      qb.window({ fn: "RANK", alias: "r" });
      expect(cloned.getState().windows).toHaveLength(1);
    });

    test("should deep copy ctes", () => {
      (qb.getState() as any).ctes.push({
        name: "test",
        sql: "SELECT 1",
        params: [1],
        materialized: null,
      });
      const cloned = qb.clone() as TestQueryBuilder<any>;
      qb.getState().ctes[0].params.push(2);
      expect(cloned.getState().ctes[0].params).toEqual([1]);
    });

    test("should deep copy setOperations", () => {
      (qb.getState() as any).setOperations.push({
        operation: "UNION",
        sql: "SELECT 1",
        params: [1],
      });
      const cloned = qb.clone() as TestQueryBuilder<any>;
      qb.getState().setOperations[0].params.push(2);
      expect(cloned.getState().setOperations[0].params).toEqual([1]);
    });

    test("should deep copy subqueryPredicates", () => {
      (qb.getState() as any).subqueryPredicates.push({
        type: "in",
        field: "id",
        sql: "SELECT $1",
        params: ["a"],
        conjunction: "and",
      });
      const cloned = qb.clone() as TestQueryBuilder<any>;
      qb.getState().subqueryPredicates[0].params.push("b");
      expect(cloned.getState().subqueryPredicates[0].params).toEqual(["a"]);
    });
  });
});
