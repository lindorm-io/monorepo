import { describe, expect, test } from "vitest";
import { Entity } from "../../../../../decorators/Entity.js";
import { Generated } from "../../../../../decorators/Generated.js";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { applyNamingStrategy } from "../../../../utils/naming/apply-naming-strategy.js";
import { generateEntityDDL } from "./generate-entity-ddl.js";

@Entity()
class SqliteNamingRefreshTokenChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

@Entity({ name: "custom_chain" })
class SqliteNamingCustomChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

describe("generateEntityDDL (SQLite) — naming strategy applies to the table name", () => {
  test("bare @Entity() emits a snake_cased table under 'snake'", () => {
    const meta = applyNamingStrategy(
      getEntityMetadata(SqliteNamingRefreshTokenChain),
      "snake",
    );
    const create = generateEntityDDL(meta, {}).tables[0];
    expect(create).toContain("sqlite_naming_refresh_token_chain");
    expect(create).not.toContain("SqliteNamingRefreshTokenChain");
  });

  test("bare @Entity() keeps the class name verbatim under 'none'", () => {
    const meta = applyNamingStrategy(
      getEntityMetadata(SqliteNamingRefreshTokenChain),
      "none",
    );
    expect(generateEntityDDL(meta, {}).tables[0]).toContain(
      "SqliteNamingRefreshTokenChain",
    );
  });

  test("@Entity({ name }) stays verbatim under 'snake'", () => {
    const meta = applyNamingStrategy(getEntityMetadata(SqliteNamingCustomChain), "snake");
    expect(generateEntityDDL(meta, {}).tables[0]).toContain("custom_chain");
  });
});
