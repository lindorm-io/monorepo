import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata } from "../../entity/types/metadata";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect";
import { mysqlDialect } from "../../drivers/mysql/utils/mysql-dialect";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect";
import type { SqlDialect } from "./sql-dialect";
import { compileSoftDelete, compileRestore } from "./compile-soft-delete";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

const softDeleteMetadata = {
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
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const noDeleteDateMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "logs",
    namespace: "app",
  },
  fields: [makeField("id", { type: "uuid" }), makeField("message", { type: "string" })],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const noNamespaceMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: null,
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe.each(dialects)("compileSoftDelete [%s]", (_name, dialect) => {
  test("should compile soft delete with simple criteria", () => {
    const result = compileSoftDelete(
      { id: "abc-123" } as any,
      softDeleteMetadata,
      dialect,
    );
    expect(result).toMatchSnapshot();
  });

  test("should compile soft delete with multiple criteria", () => {
    const result = compileSoftDelete(
      { name: "Alice", id: "abc" } as any,
      softDeleteMetadata,
      dialect,
    );
    expect(result).toMatchSnapshot();
  });

  test("should throw when entity has no @DeleteDate field", () => {
    expect(() =>
      compileSoftDelete({ id: "abc" } as any, noDeleteDateMetadata, dialect),
    ).toThrow(/no @DeleteDate field/);
  });
});

describe.each(dialects)("compileRestore [%s]", (_name, dialect) => {
  test("should compile restore with simple criteria", () => {
    const result = compileRestore({ id: "abc-123" } as any, softDeleteMetadata, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should throw when entity has no @DeleteDate field", () => {
    expect(() =>
      compileRestore({ id: "abc" } as any, noDeleteDateMetadata, dialect),
    ).toThrow(/no @DeleteDate field/);
  });
});

describe("compileSoftDelete dialect-specific: alias behavior", () => {
  test("postgres: uses AS t0 alias (supportsUpdateAlias = true)", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      postgresDialect,
    );
    expect(result.text).toContain("AS");
    expect(result.text).toContain('"t0"');
    expect(result).toMatchSnapshot();
  });

  test("mysql: uses AS t0 alias (supportsUpdateAlias = true)", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      mysqlDialect,
    );
    expect(result.text).toContain("AS");
    expect(result.text).toContain("`t0`");
    expect(result).toMatchSnapshot();
  });

  test("sqlite: no alias (supportsUpdateAlias = false)", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      sqliteDialect,
    );
    expect(result.text).not.toContain("AS");
    expect(result.text).not.toContain('"t0"');
    expect(result).toMatchSnapshot();
  });
});

describe("compileSoftDelete dialect-specific: dateNowExpression", () => {
  test("postgres: uses NOW()", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      postgresDialect,
    );
    expect(result.text).toContain("NOW()");
  });

  test("mysql: uses NOW(3)", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      mysqlDialect,
    );
    expect(result.text).toContain("NOW(3)");
  });

  test("sqlite: uses strftime", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      sqliteDialect,
    );
    expect(result.text).toContain("strftime");
  });
});

describe("compileSoftDelete dialect-specific: namespace/schema", () => {
  test("postgres: schema-qualifies the table name", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      postgresDialect,
    );
    expect(result.text).toContain('"app"."users"');
  });

  test("mysql: schema-qualifies the table name", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      mysqlDialect,
    );
    expect(result.text).toContain("`app`.`users`");
  });

  test("sqlite: does not schema-qualify (supportsNamespace = false)", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      softDeleteMetadata,
      sqliteDialect,
    );
    expect(result.text).not.toContain("app");
    expect(result.text).toContain('"users"');
  });

  test("postgres: no schema when namespace is null", () => {
    const result = compileSoftDelete(
      { id: "abc" } as any,
      noNamespaceMetadata,
      postgresDialect,
    );
    expect(result.text).not.toContain('"app"');
    expect(result.text).toContain('"users"');
    expect(result).toMatchSnapshot();
  });
});
