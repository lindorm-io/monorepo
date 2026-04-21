import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { ExpiryDateField } from "./ExpiryDateField.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "ExpiryDateFieldDecorated" })
class ExpiryDateFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @ExpiryDateField()
  expiresAt!: Date | null;
}

describe("ExpiryDateField", () => {
  test("should register expiresAt as nullable timestamp", () => {
    const meta = getEntityMetadata(ExpiryDateFieldDecorated);
    const field = meta.fields.find((f) => f.decorator === "ExpiryDate");
    expect(field).toBeDefined();
    expect(field!.type).toBe("timestamp");
    expect(field!.nullable).toBe(true);
    expect(field!.readonly).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(ExpiryDateFieldDecorated)).toMatchSnapshot();
  });
});
