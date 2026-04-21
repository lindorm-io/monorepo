import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { DeleteDateField } from "./DeleteDateField.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "DeleteDateFieldDecorated" })
class DeleteDateFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @DeleteDateField()
  deletedAt!: Date | null;
}

describe("DeleteDateField", () => {
  test("should register deletedAt as nullable timestamp", () => {
    const meta = getEntityMetadata(DeleteDateFieldDecorated);
    const field = meta.fields.find((f) => f.decorator === "DeleteDate");
    expect(field).toBeDefined();
    expect(field!.type).toBe("timestamp");
    expect(field!.nullable).toBe(true);
    expect(field!.readonly).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(DeleteDateFieldDecorated)).toMatchSnapshot();
  });

  test("should generate auto-index for deleteDate + anchor key", () => {
    const meta = getEntityMetadata(DeleteDateFieldDecorated);
    const autoIdx = meta.indexes.find((i) => i.keys.some((k) => k.key === "deletedAt"));
    expect(autoIdx).toBeDefined();
  });
});
