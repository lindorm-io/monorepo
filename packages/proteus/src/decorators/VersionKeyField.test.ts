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
  @Generated("uuid")
  id!: string;

  @VersionKeyField()
  @Generated("uuid")
  versionId!: string;
}

@Entity({ name: "VersionKeyFieldMarkerOnly" })
class VersionKeyFieldMarkerOnly {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @VersionKeyField()
  versionId!: string;
}

@Entity({ name: "VersionKeyFieldTypedMarkerOnly" })
class VersionKeyFieldTypedMarkerOnly {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @VersionKeyField("uuid")
  versionId!: string;
}

@Entity({ name: "VersionKeyFieldInteger" })
class VersionKeyFieldInteger {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKeyField("integer")
  @Generated("increment")
  revision!: number;
}

@Entity({ name: "VersionKeyFieldTypeWithName" })
class VersionKeyFieldTypeWithName {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @VersionKeyField("uuid", { name: "version_id" })
  @Generated("uuid")
  versionId!: string;
}

describe("VersionKeyField", () => {
  test("should register uuid version key field (default)", () => {
    expect(getEntityMetadata(VersionKeyFieldUuid)).toMatchSnapshot();
  });

  test("bare marker (no type, no @Generated) throws a missing-field-type metadata error", () => {
    expect(() => getEntityMetadata(VersionKeyFieldMarkerOnly)).toThrow(
      "Field has no resolvable type",
    );
  });

  test("typed marker alone (no @Generated) stages a primary key + version key + field but NO generated entry", () => {
    const meta = getEntityMetadata(VersionKeyFieldTypedMarkerOnly);
    expect(meta.fields.find((f) => f.key === "versionId")).toBeDefined();
    expect(meta.primaryKeys).toContain("versionId");
    expect(meta.versionKeys).toContain("versionId");
    expect(meta.generated.find((g) => g.key === "versionId")).toBeUndefined();
  });

  test("marker paired with @Generated stages field, primary key, version key, AND generated", () => {
    const meta = getEntityMetadata(VersionKeyFieldUuid);
    expect(meta.fields.find((f) => f.key === "versionId")).toBeDefined();
    expect(meta.primaryKeys).toContain("versionId");
    expect(meta.versionKeys).toContain("versionId");
    expect(meta.generated.find((g) => g.key === "versionId")).toBeDefined();
  });

  test('integer marker with explicit @Generated("increment")', () => {
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
