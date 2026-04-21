import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { DefaultOrder } from "./DefaultOrder.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { Field } from "./Field.js";
import { CreateDateField } from "./CreateDateField.js";
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
