import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Min } from "./Min";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "MinDecoratedInteger" })
class MinDecoratedInteger {
  @PrimaryKeyField()
  id!: string;

  @Min(0)
  @Field("integer")
  age!: number;
}

@Entity({ name: "MinDecoratedNegative" })
class MinDecoratedNegative {
  @PrimaryKeyField()
  id!: string;

  @Min(-273)
  @Field("float")
  temperature!: number;
}

@Entity({ name: "MinNoDecorator" })
class MinNoDecorator {
  @PrimaryKeyField()
  id!: string;

  @Field("integer")
  count!: number;
}

describe("Min", () => {
  test("should stage min value of zero on integer field", () => {
    const meta = getEntityMetadata(MinDecoratedInteger);
    const field = meta.fields.find((f) => f.key === "age")!;
    expect(field.min).toBe(0);
  });

  test("should stage negative min value on float field", () => {
    const meta = getEntityMetadata(MinDecoratedNegative);
    const field = meta.fields.find((f) => f.key === "temperature")!;
    expect(field.min).toBe(-273);
  });

  test("should default min to null when not decorated", () => {
    const meta = getEntityMetadata(MinNoDecorator);
    const field = meta.fields.find((f) => f.key === "count")!;
    expect(field.min).toBeNull();
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(MinDecoratedInteger)).toMatchSnapshot();
  });
});
