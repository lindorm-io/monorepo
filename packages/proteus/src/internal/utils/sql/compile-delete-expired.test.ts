import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { postgresDialect } from "#internal/drivers/postgres/utils/postgres-dialect";
import { mysqlDialect } from "#internal/drivers/mysql/utils/mysql-dialect";
import { sqliteDialect } from "#internal/drivers/sqlite/utils/sqlite-dialect";
import type { SqlDialect } from "./sql-dialect";
import { compileDeleteExpired } from "./compile-delete-expired";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

const expiryMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "sessions",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("expiresAt", {
      type: "timestamp",
      name: "expires_at",
      decorator: "ExpiryDate",
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const noExpiryMetadata = {
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

const noNamespaceMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "sessions",
    namespace: null,
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("expiresAt", {
      type: "timestamp",
      name: "expires_at",
      decorator: "ExpiryDate",
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe.each(dialects)("compileDeleteExpired [%s]", (_name, dialect) => {
  test("should compile delete expired statement", () => {
    const result = compileDeleteExpired(expiryMetadata, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should throw when entity has no @ExpiryDate field", () => {
    expect(() => compileDeleteExpired(noExpiryMetadata, dialect)).toThrow(
      /no @ExpiryDate field/,
    );
  });
});

describe("compileDeleteExpired dialect-specific: alias behavior", () => {
  test("postgres: uses AS t0 alias (supportsDeleteAlias = true)", () => {
    const result = compileDeleteExpired(expiryMetadata, postgresDialect);
    expect(result.text).toContain("AS");
    expect(result.text).toContain('"t0"');
    expect(result).toMatchSnapshot();
  });

  test("mysql: no alias (supportsDeleteAlias = false)", () => {
    const result = compileDeleteExpired(expiryMetadata, mysqlDialect);
    expect(result.text).not.toMatch(/AS\s+`t0`/);
    expect(result).toMatchSnapshot();
  });

  test("sqlite: no alias (supportsDeleteAlias = false)", () => {
    const result = compileDeleteExpired(expiryMetadata, sqliteDialect);
    expect(result.text).not.toMatch(/AS\s+"t0"/);
    expect(result).toMatchSnapshot();
  });
});

describe("compileDeleteExpired dialect-specific: dateNowExpression", () => {
  test("postgres: uses NOW()", () => {
    const result = compileDeleteExpired(expiryMetadata, postgresDialect);
    expect(result.text).toContain("NOW()");
  });

  test("mysql: uses NOW(3)", () => {
    const result = compileDeleteExpired(expiryMetadata, mysqlDialect);
    expect(result.text).toContain("NOW(3)");
  });

  test("sqlite: uses strftime", () => {
    const result = compileDeleteExpired(expiryMetadata, sqliteDialect);
    expect(result.text).toContain("strftime");
  });
});

describe("compileDeleteExpired dialect-specific: namespace", () => {
  test("postgres: schema-qualifies the table name", () => {
    const result = compileDeleteExpired(expiryMetadata, postgresDialect);
    expect(result.text).toContain('"app"."sessions"');
  });

  test("sqlite: does not schema-qualify", () => {
    const result = compileDeleteExpired(expiryMetadata, sqliteDialect);
    expect(result.text).not.toContain("app");
    expect(result.text).toContain('"sessions"');
  });

  test("postgres: unqualified when namespace is null", () => {
    const result = compileDeleteExpired(noNamespaceMetadata, postgresDialect);
    expect(result.text).not.toContain('"app"');
    expect(result.text).toContain('"sessions"');
    expect(result).toMatchSnapshot();
  });
});
