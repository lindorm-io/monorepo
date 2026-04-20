import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { VersionEndDateField } from "./VersionEndDateField";
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
