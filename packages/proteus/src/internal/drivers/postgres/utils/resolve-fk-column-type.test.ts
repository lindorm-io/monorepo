import { Entity } from "../../../../decorators/Entity.js";
import { Enum } from "../../../../decorators/Enum.js";
import { Field } from "../../../../decorators/Field.js";
import { Generated } from "../../../../decorators/Generated.js";
import { PrimaryKey } from "../../../../decorators/PrimaryKey.js";
import { PrimaryKeyField } from "../../../../decorators/PrimaryKeyField.js";
import { resolveFkColumnType } from "../../../drivers/postgres/utils/resolve-fk-column-type.js";
import { ProteusError } from "../../../../errors/index.js";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Test entities — must be at module scope for stage-3 decorator execution
// ---------------------------------------------------------------------------

@Entity({ name: "FkRefUuid" })
class FkRefUuid {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "FkRefInteger" })
class FkRefInteger {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;

  @Field("string")
  label!: string;
}

enum Status {
  Active = "active",
  Inactive = "inactive",
}

@Entity({ name: "FkRefEnum" })
class FkRefEnum {
  @PrimaryKeyField()
  id!: string;

  @Enum(Status)
  @Field("enum")
  status!: Status;
}

const OPTS = {};
const OPTS_SCOPED = { namespace: "myschema" };

describe("resolveFkColumnType", () => {
  test("resolves UUID PK field type from a referenced entity", () => {
    expect(resolveFkColumnType(() => FkRefUuid, "id", OPTS)).toMatchSnapshot();
  });

  test("resolves INTEGER PK field type from a referenced entity", () => {
    expect(resolveFkColumnType(() => FkRefInteger, "id", OPTS)).toMatchSnapshot();
  });

  test("uses namespace when resolving UUID FK (snapshot includes schema-qualified name)", () => {
    expect(resolveFkColumnType(() => FkRefUuid, "id", OPTS_SCOPED)).toMatchSnapshot();
  });

  test("resolves enum FK column type using the foreign entity table name, not the caller table name", () => {
    // When a FK references a foreign entity with enum PK, the enum type name
    // must be derived from the foreign entity's table, not the child/caller table.
    expect(resolveFkColumnType(() => FkRefEnum, "id", OPTS)).toMatchSnapshot();
  });

  test("throws ProteusError when the specified foreignPkKey does not exist", () => {
    expect(() => resolveFkColumnType(() => FkRefUuid, "nonexistent", OPTS)).toThrow(
      ProteusError,
    );
  });
});
