import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Nullable } from "./Nullable.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "NullableDecorated" })
class NullableDecorated {
  @PrimaryKeyField()
  id!: string;

  @Nullable()
  @Field("string")
  description!: string | null;
}

@Entity({ name: "NullableNotDecorated" })
class NullableNotDecorated {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("Nullable", () => {
  test("should set nullable to true on the field", () => {
    const meta = getEntityMetadata(NullableDecorated);
    const field = meta.fields.find((f) => f.key === "description")!;
    expect(field.nullable).toBe(true);
  });

  test("should default nullable to false when not decorated", () => {
    const meta = getEntityMetadata(NullableNotDecorated);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.nullable).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(NullableDecorated)).toMatchSnapshot();
  });
});
