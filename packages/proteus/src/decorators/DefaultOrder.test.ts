import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { DefaultOrder } from "./DefaultOrder";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { Field } from "./Field";
import { CreateDateField } from "./CreateDateField";
import { describe, expect, test } from "vitest";

@Entity({ name: "DefaultOrderSingle" })
@DefaultOrder({ createdAt: "DESC" })
class DefaultOrderSingle {
  @PrimaryKeyField()
  id!: string;

  @CreateDateField()
  createdAt!: Date;
}

@Entity({ name: "DefaultOrderMultiple" })
@DefaultOrder({ lastName: "ASC", firstName: "ASC" })
class DefaultOrderMultiple {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  firstName!: string;

  @Field("string")
  lastName!: string;
}

@Entity({ name: "NoDefaultOrder" })
class NoDefaultOrder {
  @PrimaryKeyField()
  id!: string;
}

describe("DefaultOrder", () => {
  test("should stage single-field default order", () => {
    const metadata = getEntityMetadata(DefaultOrderSingle);
    expect(metadata.defaultOrder).toMatchSnapshot();
  });

  test("should stage multi-field default order", () => {
    const metadata = getEntityMetadata(DefaultOrderMultiple);
    expect(metadata.defaultOrder).toMatchSnapshot();
  });

  test("should return null when no @DefaultOrder decorator", () => {
    const metadata = getEntityMetadata(NoDefaultOrder);
    expect(metadata.defaultOrder).toBeNull();
  });
});
