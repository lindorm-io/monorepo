import { CreateDateField } from "../../../decorators/CreateDateField.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { Nullable } from "../../../decorators/Nullable.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { ReadOnly } from "../../../decorators/ReadOnly.js";
import { UpdateDateField } from "../../../decorators/UpdateDateField.js";
import { VersionField } from "../../../decorators/VersionField.js";
import { removeReadonlyDataFields } from "./remove-readonly-data-fields.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "RemoveReadonlyEntity" })
class RemoveReadonlyEntity {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("string")
  description!: string | null;

  @ReadOnly()
  @Field("string")
  readonlyField!: string;
}

describe("removeReadonlyDataFields", () => {
  test("should exclude readonly Field fields from result", () => {
    const now = new Date();
    const entity = {
      id: "abc",
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: "Test",
      description: null,
      readonlyField: "should-be-removed",
    } as RemoveReadonlyEntity;

    const result = removeReadonlyDataFields(RemoveReadonlyEntity, entity);

    // Only removes fields where decorator="Field" AND readonly=true
    // id: PrimaryKeyField -> decorator="Field", readonly=true -> REMOVED
    // readonlyField: Field + readonly=true -> REMOVED
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("readonlyField");
  });

  test("should keep non-readonly Field fields", () => {
    const now = new Date();
    const entity = {
      id: "abc",
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: "Test",
      description: "Some text",
      readonlyField: "x",
    } as RemoveReadonlyEntity;

    const result = removeReadonlyDataFields(RemoveReadonlyEntity, entity);

    expect(result).toHaveProperty("name", "Test");
    expect(result).toHaveProperty("description", "Some text");
  });

  test("should keep Version, CreateDate, UpdateDate fields (decorator is not Field)", () => {
    const now = new Date();
    const entity = {
      id: "abc",
      version: 2,
      createdAt: now,
      updatedAt: now,
      name: "Test",
      description: null,
      readonlyField: "x",
    } as RemoveReadonlyEntity;

    const result = removeReadonlyDataFields(RemoveReadonlyEntity, entity);

    // version, createdAt, updatedAt have decorator !== "Field" so they pass through
    expect(result).toHaveProperty("version", 2);
    expect(result).toHaveProperty("createdAt", now);
    expect(result).toHaveProperty("updatedAt", now);
  });
});
