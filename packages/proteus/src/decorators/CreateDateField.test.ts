import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { CreateDateField } from "./CreateDateField.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "CreateDateFieldDecorated" })
class CreateDateFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @CreateDateField()
  createdAt!: Date;
}

describe("CreateDateField", () => {
  test("should register createdAt with timestamp type", () => {
    const meta = getEntityMetadata(CreateDateFieldDecorated);
    const field = meta.fields.find((f) => f.decorator === "CreateDate");
    expect(field).toBeDefined();
    expect(field!.type).toBe("timestamp");
    expect(field!.readonly).toBe(true);
    expect(field!.nullable).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(CreateDateFieldDecorated)).toMatchSnapshot();
  });
});
