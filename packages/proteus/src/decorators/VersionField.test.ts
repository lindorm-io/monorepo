import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { VersionField } from "./VersionField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "VersionFieldDecorated" })
class VersionFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;
}

describe("VersionField", () => {
  test("should register version field metadata", () => {
    expect(getEntityMetadata(VersionFieldDecorated)).toMatchSnapshot();
  });

  test("should register integer type version field", () => {
    const meta = getEntityMetadata(VersionFieldDecorated);
    const field = meta.fields.find((f) => f.key === "version");
    expect(field!.type).toBe("integer");
    expect(field!.decorator).toBe("Version");
    expect(field!.readonly).toBe(true);
  });
});
