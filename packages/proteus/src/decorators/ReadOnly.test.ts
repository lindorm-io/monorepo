import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { ReadOnly } from "./ReadOnly.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "ReadOnlyDecorated" })
class ReadOnlyDecorated {
  @PrimaryKeyField()
  id!: string;

  @ReadOnly()
  @Field("string")
  createdBy!: string;
}

@Entity({ name: "ReadOnlyNotDecorated" })
class ReadOnlyNotDecorated {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("ReadOnly", () => {
  test("should set readonly to true on the field", () => {
    const meta = getEntityMetadata(ReadOnlyDecorated);
    const field = meta.fields.find((f) => f.key === "createdBy")!;
    expect(field.readonly).toBe(true);
  });

  test("should default readonly to false when not decorated", () => {
    const meta = getEntityMetadata(ReadOnlyNotDecorated);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.readonly).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(ReadOnlyDecorated)).toMatchSnapshot();
  });
});
