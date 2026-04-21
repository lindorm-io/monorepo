import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { VersionStartDateField } from "./VersionStartDateField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "VersionStartDateFieldDecorated" })
class VersionStartDateFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @VersionStartDateField()
  startAt!: Date;
}

describe("VersionStartDateField", () => {
  test("should register startAt with timestamp type", () => {
    const meta = getEntityMetadata(VersionStartDateFieldDecorated);
    const field = meta.fields.find((f) => f.decorator === "VersionStartDate");
    expect(field).toBeDefined();
    expect(field!.type).toBe("timestamp");
    expect(field!.readonly).toBe(true);
    expect(field!.nullable).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(VersionStartDateFieldDecorated)).toMatchSnapshot();
  });
});
