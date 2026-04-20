import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Precision } from "./Precision";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { describe, expect, test } from "vitest";

@Entity({ name: "PrecisionWithScale" })
class PrecisionWithScale {
  @PrimaryKeyField()
  id!: string;

  @Precision(10, 2)
  @Field("decimal")
  price!: number;
}

@Entity({ name: "PrecisionWithoutScale" })
class PrecisionWithoutScale {
  @PrimaryKeyField()
  id!: string;

  @Precision(8)
  @Field("decimal")
  total!: number;
}

@Entity({ name: "PrecisionNoDecorator" })
class PrecisionNoDecorator {
  @PrimaryKeyField()
  id!: string;

  @Field("float")
  value!: number;
}

describe("Precision", () => {
  test("should stage precision and scale on the field", () => {
    const meta = getEntityMetadata(PrecisionWithScale);
    const field = meta.fields.find((f) => f.key === "price")!;
    expect(field.precision).toBe(10);
    expect(field.scale).toBe(2);
  });

  test("should default scale to 0 when not provided", () => {
    const meta = getEntityMetadata(PrecisionWithoutScale);
    const field = meta.fields.find((f) => f.key === "total")!;
    expect(field.precision).toBe(8);
    expect(field.scale).toBe(0);
  });

  test("should default precision and scale to null when not decorated", () => {
    const meta = getEntityMetadata(PrecisionNoDecorator);
    const field = meta.fields.find((f) => f.key === "value")!;
    expect(field.precision).toBeNull();
    expect(field.scale).toBeNull();
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(PrecisionWithScale)).toMatchSnapshot();
  });
});
