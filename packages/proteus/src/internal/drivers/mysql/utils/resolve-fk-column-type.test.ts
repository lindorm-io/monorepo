import { Entity } from "../../../../decorators/Entity.js";
import { Enum } from "../../../../decorators/Enum.js";
import { Field } from "../../../../decorators/Field.js";
import { Generated } from "../../../../decorators/Generated.js";
import { Max } from "../../../../decorators/Max.js";
import { PrimaryKey } from "../../../../decorators/PrimaryKey.js";
import { PrimaryKeyField } from "../../../../decorators/PrimaryKeyField.js";
import { NotSupportedError } from "../../../../errors/index.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import { mapFieldTypeMysql } from "./map-field-type-mysql.js";
import { resolveFkColumnType } from "./resolve-fk-column-type.js";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Test entities — must be at module scope for stage-3 decorator execution
// ---------------------------------------------------------------------------

@Entity({ name: "MysqlFkRefUuid" })
class MysqlFkRefUuid {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "MysqlFkRefInteger" })
class MysqlFkRefInteger {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;
}

@Entity({ name: "MysqlFkRefVarchar" })
class MysqlFkRefVarchar {
  @PrimaryKey()
  @Max(64)
  @Field("string")
  id!: string;
}

enum MysqlFkStatus {
  Active = "active",
  Inactive = "inactive",
}

@Entity({ name: "MysqlFkRefEnum" })
class MysqlFkRefEnum {
  @PrimaryKey()
  @Enum(MysqlFkStatus)
  @Field("enum")
  status!: MysqlFkStatus;
}

@Entity({ name: "MysqlFkRefStringNoMax" })
class MysqlFkRefStringNoMax {
  @PrimaryKey()
  @Field("string")
  id!: string;
}

@Entity({ name: "MysqlFkRefLindormId" })
class MysqlFkRefLindormId {
  @PrimaryKeyField("lindorm_id") @Generated() id!: string;
}

describe("resolveFkColumnType (mysql)", () => {
  test("FK column type equals the referenced PK column type by construction", () => {
    for (const target of [
      MysqlFkRefUuid,
      MysqlFkRefInteger,
      MysqlFkRefVarchar,
      MysqlFkRefLindormId,
    ]) {
      const meta = getEntityMetadata(target);
      const pk = meta.primaryKeys[0];
      const pkField = meta.fields.find((f) => f.key === pk)!;
      expect(resolveFkColumnType(() => target, pk)).toBe(mapFieldTypeMysql(pkField));
    }
  });

  test("resolves the coherent type per PK-capable field type", () => {
    expect({
      uuid: resolveFkColumnType(() => MysqlFkRefUuid, "id"),
      integer: resolveFkColumnType(() => MysqlFkRefInteger, "id"),
      varchar: resolveFkColumnType(() => MysqlFkRefVarchar, "id"),
      enum: resolveFkColumnType(() => MysqlFkRefEnum, "status"),
      lindormId: resolveFkColumnType(() => MysqlFkRefLindormId, "id"),
    }).toMatchSnapshot();
  });

  test("enum PK resolves the same inline enum type as the PK column", () => {
    expect(resolveFkColumnType(() => MysqlFkRefEnum, "status")).toBe(
      "enum('active','inactive')",
    );
  });

  test("throws NotSupportedError for a string PK without max (TEXT is unkeyable)", () => {
    expect(() => resolveFkColumnType(() => MysqlFkRefStringNoMax, "id")).toThrow(
      NotSupportedError,
    );
    expect(() => resolveFkColumnType(() => MysqlFkRefStringNoMax, "id")).toThrow(
      /MySQL cannot reference it with a foreign key/,
    );
  });

  test("throws ProteusError when the referenced PK field does not exist", () => {
    expect(() => resolveFkColumnType(() => MysqlFkRefUuid, "missing")).toThrow(
      /Foreign primary key field "missing" not found/,
    );
  });
});
