import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { Transform } from "./Transform";
import { describe, expect, test } from "vitest";

const toUpperCase = (value: unknown) => (value as string).toUpperCase();
const toLowerCase = (raw: unknown) => (raw as string).toLowerCase();

const jsonTo = (value: unknown) => JSON.stringify(value);
const jsonFrom = (raw: unknown) => JSON.parse(raw as string);

@Entity({ name: "TransformStringDecorated" })
class TransformStringDecorated {
  @PrimaryKeyField()
  id!: string;

  @Transform({ to: toUpperCase, from: toLowerCase })
  @Field("string")
  code!: string;
}

@Entity({ name: "TransformJsonDecorated" })
class TransformJsonDecorated {
  @PrimaryKeyField()
  id!: string;

  @Transform({ to: jsonTo, from: jsonFrom })
  @Field("string")
  payload!: object;
}

@Entity({ name: "TransformNoDecorator" })
class TransformNoDecorator {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("Transform", () => {
  test("should stage transform functions on the field", () => {
    const meta = getEntityMetadata(TransformStringDecorated);
    const field = meta.fields.find((f) => f.key === "code")!;
    expect(field.transform).toBeDefined();
    expect(field.transform!.to).toBe(toUpperCase);
    expect(field.transform!.from).toBe(toLowerCase);
  });

  test("should correctly reference the to/from transform functions for JSON serialization", () => {
    const meta = getEntityMetadata(TransformJsonDecorated);
    const field = meta.fields.find((f) => f.key === "payload")!;
    expect(field.transform!.to).toBe(jsonTo);
    expect(field.transform!.from).toBe(jsonFrom);
  });

  test("should default transform to null when not decorated", () => {
    const meta = getEntityMetadata(TransformNoDecorator);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.transform).toBeNull();
  });

  test("transform.to function should operate correctly", () => {
    const meta = getEntityMetadata(TransformStringDecorated);
    const field = meta.fields.find((f) => f.key === "code")!;
    expect(field.transform!.to("hello")).toBe("HELLO");
    expect(field.transform!.from("WORLD")).toBe("world");
  });

  test("should match snapshot", () => {
    // Transform functions are not serializable so we test specific fields
    const meta = getEntityMetadata(TransformStringDecorated);
    const field = meta.fields.find((f) => f.key === "code")!;
    expect(field.key).toBe("code");
    expect(field.decorator).toBe("Field");
    expect(field.transform).toBeDefined();
  });
});
