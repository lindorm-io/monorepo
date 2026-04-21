import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Max } from "./Max.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "MaxDecoratedInteger" })
class MaxDecoratedInteger {
  @PrimaryKeyField()
  id!: string;

  @Max(100)
  @Field("integer")
  score!: number;
}

@Entity({ name: "MaxDecoratedString" })
class MaxDecoratedString {
  @PrimaryKeyField()
  id!: string;

  @Max(255)
  @Field("string")
  title!: string;
}

@Entity({ name: "MaxNoDecorator" })
class MaxNoDecorator {
  @PrimaryKeyField()
  id!: string;

  @Field("integer")
  count!: number;
}

describe("Max", () => {
  test("should stage max value on integer field", () => {
    const meta = getEntityMetadata(MaxDecoratedInteger);
    const field = meta.fields.find((f) => f.key === "score")!;
    expect(field.max).toBe(100);
  });

  test("should stage max length on string field", () => {
    const meta = getEntityMetadata(MaxDecoratedString);
    const field = meta.fields.find((f) => f.key === "title")!;
    expect(field.max).toBe(255);
  });

  test("should default max to null when not decorated", () => {
    const meta = getEntityMetadata(MaxNoDecorator);
    const field = meta.fields.find((f) => f.key === "count")!;
    expect(field.max).toBeNull();
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(MaxDecoratedInteger)).toMatchSnapshot();
  });
});
