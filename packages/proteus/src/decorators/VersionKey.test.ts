import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Generated } from "./Generated";
import { PrimaryKey } from "./PrimaryKey";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { VersionKey } from "./VersionKey";
import { describe, expect, test } from "vitest";

@Entity({ name: "VersionKeyFieldLevel" })
class VersionKeyFieldLevel {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKey()
  @Field("uuid")
  @Generated("uuid")
  versionId!: string;
}

@Entity({ name: "VersionKeyClassLevel" })
@VersionKey<typeof VersionKeyClassLevel>(["id", "versionId"])
class VersionKeyClassLevel {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @Field("uuid")
  @Generated("uuid")
  versionId!: string;
}

describe("VersionKey", () => {
  test("should register field-level version key", () => {
    expect(getEntityMetadata(VersionKeyFieldLevel)).toMatchSnapshot();
  });

  test("should register class-level version keys", () => {
    expect(getEntityMetadata(VersionKeyClassLevel)).toMatchSnapshot();
  });

  test("should add version key to both primaryKeys and versionKeys", () => {
    const meta = getEntityMetadata(VersionKeyFieldLevel);
    expect(meta.primaryKeys).toContain("versionId");
    expect(meta.versionKeys).toContain("versionId");
  });

  test("should set class-level version keys in both primaryKeys and versionKeys", () => {
    const meta = getEntityMetadata(VersionKeyClassLevel);
    expect(meta.versionKeys).toContain("id");
    expect(meta.versionKeys).toContain("versionId");
    expect(meta.primaryKeys).toContain("id");
    expect(meta.primaryKeys).toContain("versionId");
  });
});
