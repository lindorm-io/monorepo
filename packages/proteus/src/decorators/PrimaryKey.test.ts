import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Generated } from "./Generated";
import { PrimaryKey } from "./PrimaryKey";
import { PrimaryKeyField } from "./PrimaryKeyField";

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
