import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Embeddable } from "./Embeddable.js";
import { Embedded } from "./Embedded.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Nullable } from "./Nullable.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Embeddable()
class Address {
  @Field("string")
  street!: string;

  @Field("string")
  city!: string;

  @Field("string")
  @Nullable()
  zip!: string | null;
}

@Entity({ name: "PersonWithAddress" })
class PersonWithAddress {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Embedded(() => Address)
  homeAddress!: Address | null;
}

@Entity({ name: "PersonWithTwoAddresses" })
class PersonWithTwoAddresses {
  @PrimaryKeyField()
  id!: string;

  @Embedded(() => Address)
  homeAddress!: Address | null;

  @Embedded(() => Address, { prefix: "work_" })
  workAddress!: Address | null;
}

describe("Embeddable", () => {
  test("should mark class as embeddable via Symbol.metadata", () => {
    const meta = (Address as any)[Symbol.metadata];
    expect(meta.__embeddable).toBe(true);
  });

  test("should NOT register embeddable class as entity", () => {
    expect(() => getEntityMetadata(Address as any)).toThrow();
  });
});

describe("Embedded", () => {
  test("should flatten embeddable fields into parent entity metadata", () => {
    const metadata = getEntityMetadata(PersonWithAddress);
    expect(metadata).toMatchSnapshot();
  });

  test("should create fields with dotted keys", () => {
    const metadata = getEntityMetadata(PersonWithAddress);
    const streetField = metadata.fields.find((f) => f.key === "homeAddress.street");
    expect(streetField).toBeDefined();
    expect(streetField!.name).toBe("homeAddress_street");
    expect(streetField!.type).toBe("string");
    expect(streetField!.embedded).toEqual({
      parentKey: "homeAddress",
      constructor: expect.any(Function),
    });
  });

  test("should create fields with prefixed column names", () => {
    const metadata = getEntityMetadata(PersonWithAddress);
    const fields = metadata.fields.filter((f) => f.embedded);
    const names = fields.map((f) => f.name);
    expect(names).toContain("homeAddress_street");
    expect(names).toContain("homeAddress_city");
    expect(names).toContain("homeAddress_zip");
  });

  test("should support custom prefix", () => {
    const metadata = getEntityMetadata(PersonWithTwoAddresses);
    const workFields = metadata.fields.filter(
      (f) => f.embedded?.parentKey === "workAddress",
    );
    const names = workFields.map((f) => f.name);
    expect(names).toContain("work_street");
    expect(names).toContain("work_city");
    expect(names).toContain("work_zip");
  });

  test("should support multiple embeddeds of the same type", () => {
    const metadata = getEntityMetadata(PersonWithTwoAddresses);
    const embeddedFields = metadata.fields.filter((f) => f.embedded);
    // 3 fields from homeAddress + 3 fields from workAddress
    expect(embeddedFields).toHaveLength(6);
  });

  test("should preserve original nullable state of embedded child fields", () => {
    const metadata = getEntityMetadata(PersonWithAddress);
    // street has no @Nullable — should remain non-nullable even when embedded
    const streetField = metadata.fields.find((f) => f.key === "homeAddress.street");
    expect(streetField!.nullable).toBe(false);
    // city has no @Nullable — should also remain non-nullable
    const cityField = metadata.fields.find((f) => f.key === "homeAddress.city");
    expect(cityField!.nullable).toBe(false);
  });

  test("should preserve @Nullable modifier from embeddable class", () => {
    const metadata = getEntityMetadata(PersonWithAddress);
    const zipField = metadata.fields.find((f) => f.key === "homeAddress.zip");
    // zip was @Nullable() in the embeddable — should remain nullable
    expect(zipField!.nullable).toBe(true);
  });

  test("should not include embedded fields in primaryKeys", () => {
    const metadata = getEntityMetadata(PersonWithAddress);
    const embeddedKeys = metadata.fields.filter((f) => f.embedded).map((f) => f.key);
    for (const key of embeddedKeys) {
      expect(metadata.primaryKeys).not.toContain(key);
    }
  });

  test("should set embedded to null for non-embedded fields", () => {
    const metadata = getEntityMetadata(PersonWithAddress);
    const nameField = metadata.fields.find((f) => f.key === "name");
    expect(nameField!.embedded).toBeNull();
  });
});
