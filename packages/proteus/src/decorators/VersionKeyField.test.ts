import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { PrimaryKey } from "./PrimaryKey.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { VersionKeyField } from "./VersionKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "VersionKeyFieldUuid" })
class VersionKeyFieldUuid {
  @PrimaryKeyField()
  id!: string;

  @VersionKeyField()
  versionId!: string;
}

@Entity({ name: "VersionKeyFieldInteger" })
class VersionKeyFieldInteger {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKeyField("integer")
  revision!: number;
}

@Entity({ name: "VersionKeyFieldTypeWithName" })
class VersionKeyFieldTypeWithName {
  @PrimaryKeyField()
  id!: string;

  @VersionKeyField("uuid", { name: "version_id" })
  versionId!: string;
}

describe("VersionKeyField", () => {
  test("should register uuid version key field (default)", () => {
    expect(getEntityMetadata(VersionKeyFieldUuid)).toMatchSnapshot();
  });

  test("should register field, primary key, version key, and generated", () => {
    const meta = getEntityMetadata(VersionKeyFieldUuid);
    expect(meta.fields.find((f) => f.key === "versionId")).toBeDefined();
    expect(meta.primaryKeys).toContain("versionId");
    expect(meta.versionKeys).toContain("versionId");
    expect(meta.generated.find((g) => g.key === "versionId")).toBeDefined();
  });

  test("should register integer version key with increment strategy", () => {
    const meta = getEntityMetadata(VersionKeyFieldInteger);
    const gen = meta.generated.find((g) => g.key === "revision");
    expect(gen!.strategy).toBe("increment");
    expect(meta.versionKeys).toContain("revision");
  });

  test("should accept custom name via second argument", () => {
    const meta = getEntityMetadata(VersionKeyFieldTypeWithName);
    const field = meta.fields.find((f) => f.key === "versionId");
    expect(field!.name).toBe("version_id");
    expect(field!.type).toBe("uuid");
  });
});
