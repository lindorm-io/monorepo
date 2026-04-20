import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Computed } from "./Computed";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { describe, expect, test } from "vitest";

@Entity({ name: "ComputedDecorated" })
class ComputedDecorated {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  firstName!: string;

  @Field("string")
  lastName!: string;

  @Computed("first_name || ' ' || last_name")
  @Field("string")
  fullName!: string;
}

@Entity({ name: "ComputedNoDecorator" })
class ComputedNoDecorator {
  @PrimaryKeyField()
  id!: string;

  @Field("integer")
  count!: number;
}

describe("Computed", () => {
  test("should stage computed expression on the field", () => {
    const meta = getEntityMetadata(ComputedDecorated);
    const field = meta.fields.find((f) => f.key === "fullName")!;
    expect(field.computed).toBe("first_name || ' ' || last_name");
  });

  test("should auto-set readonly when computed is applied", () => {
    const meta = getEntityMetadata(ComputedDecorated);
    const field = meta.fields.find((f) => f.key === "fullName")!;
    expect(field.readonly).toBe(true);
  });

  test("should default computed to null when not decorated", () => {
    const meta = getEntityMetadata(ComputedNoDecorator);
    const field = meta.fields.find((f) => f.key === "count")!;
    expect(field.computed).toBeNull();
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(ComputedDecorated)).toMatchSnapshot();
  });
});
