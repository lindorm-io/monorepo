import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Enum } from "./Enum";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { describe, expect, test } from "vitest";

enum StatusEnum {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}

const PriorityRecord = {
  Low: 1,
  Medium: 2,
  High: 3,
};

@Entity({ name: "EnumWithTsEnum" })
class EnumWithTsEnum {
  @PrimaryKeyField()
  id!: string;

  @Enum(StatusEnum)
  @Field("enum")
  status!: StatusEnum;
}

@Entity({ name: "EnumWithRecord" })
class EnumWithRecord {
  @PrimaryKeyField()
  id!: string;

  @Enum(PriorityRecord)
  @Field("enum")
  priority!: number;
}

@Entity({ name: "EnumNoDecorator" })
class EnumNoDecorator {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  status!: string;
}

describe("Enum", () => {
  test("should stage TypeScript enum values on the field", () => {
    const meta = getEntityMetadata(EnumWithTsEnum);
    const field = meta.fields.find((f) => f.key === "status")!;
    expect(field.enum).toEqual(StatusEnum);
  });

  test("should stage plain record enum values on the field", () => {
    const meta = getEntityMetadata(EnumWithRecord);
    const field = meta.fields.find((f) => f.key === "priority")!;
    expect(field.enum).toEqual(PriorityRecord);
  });

  test("should default enum to null when not decorated", () => {
    const meta = getEntityMetadata(EnumNoDecorator);
    const field = meta.fields.find((f) => f.key === "status")!;
    expect(field.enum).toBeNull();
  });

  test("should match snapshot for TypeScript enum", () => {
    expect(getEntityMetadata(EnumWithTsEnum)).toMatchSnapshot();
  });
});
