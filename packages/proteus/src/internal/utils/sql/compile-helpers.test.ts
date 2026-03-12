import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { postgresDialect } from "#internal/drivers/postgres/utils/postgres-dialect";
import { mysqlDialect } from "#internal/drivers/mysql/utils/mysql-dialect";
import { sqliteDialect } from "#internal/drivers/sqlite/utils/sqlite-dialect";
import type { SqlDialect } from "./sql-dialect";
import {
  buildDiscriminatorPredicateQualified,
  buildDiscriminatorPredicateUnqualified,
  buildPrimaryKeyConditionsQualified,
  buildPrimaryKeyConditions,
  getDiscriminatorColumnName,
} from "./compile-helpers";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

const inheritanceMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "vehicles",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("type", { type: "string", name: "discriminator_type" }),
    makeField("name", { type: "string" }),
  ],
  relations: [],
  primaryKeys: ["id"],
  inheritance: {
    strategy: "single-table",
    discriminatorField: "type",
    discriminatorValue: "car",
    root: class {},
    children: new Map(),
  },
} as unknown as EntityMetadata;

const noInheritanceMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const compositeKeyMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "order_items",
    namespace: "app",
  },
  fields: [
    makeField("orderId", { type: "uuid", name: "order_id" }),
    makeField("itemId", { type: "uuid", name: "item_id" }),
    makeField("quantity", { type: "integer" }),
  ],
  relations: [],
  primaryKeys: ["orderId", "itemId"],
} as unknown as EntityMetadata;

describe.each(dialects)("buildDiscriminatorPredicateQualified [%s]", (_name, dialect) => {
  test("should build discriminator predicate for inheritance entity", () => {
    const params: Array<unknown> = [];
    const result = buildDiscriminatorPredicateQualified(
      inheritanceMetadata,
      "t0",
      params,
      dialect,
    );
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["car"]);
  });

  test("should return null for non-inheritance entity", () => {
    const params: Array<unknown> = [];
    const result = buildDiscriminatorPredicateQualified(
      noInheritanceMetadata,
      "t0",
      params,
      dialect,
    );
    expect(result).toBeNull();
    expect(params).toEqual([]);
  });
});

describe.each(dialects)(
  "buildDiscriminatorPredicateUnqualified [%s]",
  (_name, dialect) => {
    test("should build unqualified discriminator predicate", () => {
      const params: Array<unknown> = [];
      const result = buildDiscriminatorPredicateUnqualified(
        inheritanceMetadata,
        params,
        dialect,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["car"]);
    });

    test("should return null for non-inheritance entity", () => {
      const params: Array<unknown> = [];
      const result = buildDiscriminatorPredicateUnqualified(
        noInheritanceMetadata,
        params,
        dialect,
      );
      expect(result).toBeNull();
      expect(params).toEqual([]);
    });
  },
);

describe.each(dialects)("buildPrimaryKeyConditionsQualified [%s]", (_name, dialect) => {
  test("should build qualified PK conditions for single key", () => {
    const entity = { id: "abc-123", name: "Alice" };
    const params: Array<unknown> = [];
    const result = buildPrimaryKeyConditionsQualified(
      entity,
      noInheritanceMetadata,
      params,
      "t0",
      dialect,
    );
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["abc-123"]);
  });

  test("should build qualified PK conditions for composite key", () => {
    const entity = { orderId: "ord-1", itemId: "item-2", quantity: 5 };
    const params: Array<unknown> = [];
    const result = buildPrimaryKeyConditionsQualified(
      entity,
      compositeKeyMetadata,
      params,
      "t0",
      dialect,
    );
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["ord-1", "item-2"]);
  });

  test("should use column name mapping for PK fields", () => {
    const entity = { orderId: "ord-1", itemId: "item-2", quantity: 5 };
    const params: Array<unknown> = [];
    const result = buildPrimaryKeyConditionsQualified(
      entity,
      compositeKeyMetadata,
      params,
      "t0",
      dialect,
    );
    expect(result).toHaveLength(2);
    expect(result).toMatchSnapshot();
  });
});

describe.each(dialects)(
  "buildPrimaryKeyConditions (unqualified) [%s]",
  (_name, dialect) => {
    test("should build unqualified PK conditions for single key", () => {
      const entity = { id: "abc-123", name: "Alice" };
      const params: Array<unknown> = [];
      const result = buildPrimaryKeyConditions(
        entity,
        noInheritanceMetadata,
        params,
        dialect,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["abc-123"]);
    });

    test("should build unqualified PK conditions for composite key", () => {
      const entity = { orderId: "ord-1", itemId: "item-2", quantity: 5 };
      const params: Array<unknown> = [];
      const result = buildPrimaryKeyConditions(
        entity,
        compositeKeyMetadata,
        params,
        dialect,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["ord-1", "item-2"]);
    });
  },
);

describe("getDiscriminatorColumnName", () => {
  test("should return column name for inheritance entity", () => {
    const result = getDiscriminatorColumnName(inheritanceMetadata);
    expect(result).toBe("discriminator_type");
  });

  test("should return null for non-inheritance entity", () => {
    const result = getDiscriminatorColumnName(noInheritanceMetadata);
    expect(result).toBeNull();
  });
});
