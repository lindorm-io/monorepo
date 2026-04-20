import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Nullable } from "./Nullable";
import { PrimaryKeyField } from "./PrimaryKeyField";
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
