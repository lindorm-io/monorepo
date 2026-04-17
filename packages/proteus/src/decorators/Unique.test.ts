import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { Unique } from "./Unique";

@Entity({ name: "UniqueFieldLevel" })
class UniqueFieldLevel {
  @PrimaryKeyField()
  id!: string;

  @Unique()
  @Field("string")
  email!: string;
}

@Entity({ name: "UniqueFieldLevelNamed" })
class UniqueFieldLevelNamed {
  @PrimaryKeyField()
  id!: string;

  @Unique({ name: "uq_username" })
  @Field("string")
  username!: string;
}

@Entity({ name: "UniqueClassLevel" })
@Unique<typeof UniqueClassLevel>(["email", "tenantId"])
class UniqueClassLevel {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  email!: string;

  @Field("string")
  tenantId!: string;
}

@Entity({ name: "UniqueClassLevelNamed" })
@Unique<typeof UniqueClassLevelNamed>(["email", "tenantId"], { name: "uq_tenant_email" })
class UniqueClassLevelNamed {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  email!: string;

  @Field("string")
  tenantId!: string;
}

describe("Unique", () => {
  test("should register field-level unique constraint", () => {
    const meta = getEntityMetadata(UniqueFieldLevel);
    const uniq = meta.uniques.find((u) => u.keys.includes("email"));
    expect(uniq).toBeDefined();
    expect(uniq!.keys).toEqual(["email"]);
    expect(uniq!.name).toBeNull();
  });

  test("should register field-level named unique constraint", () => {
    const meta = getEntityMetadata(UniqueFieldLevelNamed);
    const uniq = meta.uniques.find((u) => u.keys.includes("username"));
    expect(uniq!.name).toBe("uq_username");
  });

  test("should register class-level composite unique constraint", () => {
    expect(getEntityMetadata(UniqueClassLevel)).toMatchSnapshot();
  });

  test("should register class-level named composite unique constraint", () => {
    const meta = getEntityMetadata(UniqueClassLevelNamed);
    const uniq = meta.uniques.find((u) => u.name === "uq_tenant_email");
    expect(uniq).toBeDefined();
    expect(uniq!.keys).toContain("email");
    expect(uniq!.keys).toContain("tenantId");
  });
});
