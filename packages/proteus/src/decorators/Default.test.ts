import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Default } from "./Default";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { describe, expect, test } from "vitest";

const defaultFactory = () => "guest";

@Entity({ name: "DefaultLiteralValue" })
class DefaultLiteralValue {
  @PrimaryKeyField()
  id!: string;

  @Default("active")
  @Field("string")
  status!: string;
}

@Entity({ name: "DefaultFactoryValue" })
class DefaultFactoryValue {
  @PrimaryKeyField()
  id!: string;

  @Default(defaultFactory)
  @Field("string")
  role!: string;
}

@Entity({ name: "DefaultNullLiteral" })
class DefaultNullLiteral {
  @PrimaryKeyField()
  id!: string;

  @Default(null)
  @Field("string")
  optional!: string | null;
}

@Entity({ name: "DefaultNoDecorator" })
class DefaultNoDecorator {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("Default", () => {
  test("should stage a literal default value on the field", () => {
    const meta = getEntityMetadata(DefaultLiteralValue);
    const field = meta.fields.find((f) => f.key === "status")!;
    expect(field.default).toBe("active");
  });

  test("should stage a factory function as default on the field", () => {
    const meta = getEntityMetadata(DefaultFactoryValue);
    const field = meta.fields.find((f) => f.key === "role")!;
    expect(field.default).toBe(defaultFactory);
  });

  test("should stage null as default value", () => {
    const meta = getEntityMetadata(DefaultNullLiteral);
    const field = meta.fields.find((f) => f.key === "optional")!;
    expect(field.default).toBeNull();
  });

  test("should default to null when @Default is not applied", () => {
    const meta = getEntityMetadata(DefaultNoDecorator);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.default).toBeNull();
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(DefaultLiteralValue)).toMatchSnapshot();
  });
});
