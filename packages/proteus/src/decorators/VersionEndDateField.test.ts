import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { VersionEndDateField } from "./VersionEndDateField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "VersionEndDateFieldDecorated" })
class VersionEndDateFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @VersionEndDateField()
  endAt!: Date | null;
}

describe("VersionEndDateField", () => {
  test("should register endAt as nullable timestamp", () => {
    const meta = getEntityMetadata(VersionEndDateFieldDecorated);
    const field = meta.fields.find((f) => f.decorator === "VersionEndDate");
    expect(field).toBeDefined();
    expect(field!.type).toBe("timestamp");
    expect(field!.nullable).toBe(true);
    expect(field!.readonly).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(VersionEndDateFieldDecorated)).toMatchSnapshot();
  });
});
