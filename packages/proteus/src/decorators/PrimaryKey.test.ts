import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { PrimaryKey } from "./PrimaryKey.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "PrimaryKeyFieldLevel" })
class PrimaryKeyFieldLevel {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;
}

@Entity({ name: "PrimaryKeyComposite" })
@PrimaryKey<typeof PrimaryKeyComposite>(["tenantId", "userId"])
class PrimaryKeyComposite {
  @Field("uuid")
  tenantId!: string;

  @Field("uuid")
  userId!: string;

  @Field("string")
  name!: string;
}

describe("PrimaryKey", () => {
  test("should register field-level primary key", () => {
    expect(getEntityMetadata(PrimaryKeyFieldLevel)).toMatchSnapshot();
  });

  test("should register class-level composite primary key", () => {
    expect(getEntityMetadata(PrimaryKeyComposite)).toMatchSnapshot();
  });

  test("should set primary keys array for field-level", () => {
    const meta = getEntityMetadata(PrimaryKeyFieldLevel);
    expect(meta.primaryKeys).toEqual(["id"]);
  });

  test("should set primary keys array for composite", () => {
    const meta = getEntityMetadata(PrimaryKeyComposite);
    expect(meta.primaryKeys).toContain("tenantId");
    expect(meta.primaryKeys).toContain("userId");
  });
});
