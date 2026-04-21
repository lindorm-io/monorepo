import { defaultCreateRaw } from "./default-create-raw.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { JoinKey } from "../../../decorators/JoinKey.js";
import { ManyToOne } from "../../../decorators/ManyToOne.js";
import { OneToMany } from "../../../decorators/OneToMany.js";
import { OneToOne } from "../../../decorators/OneToOne.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { VersionField } from "../../../decorators/VersionField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "CreateRawOwner" })
class CreateRawOwner {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => CreateRawItem, "owner")
  items!: CreateRawItem[];
}

@Entity({ name: "CreateRawItem" })
class CreateRawItem {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @Field("string")
  label!: string;

  @ManyToOne(() => CreateRawOwner, "items")
  owner!: CreateRawOwner | null;

  ownerId!: string | null;
}

@Entity({ name: "CreateRawWithOneToOne" })
class CreateRawWithOneToOne {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @JoinKey()
  @OneToOne(() => CreateRawRelated, "primary")
  related!: CreateRawRelated | null;

  relatedId!: string | null;
}

@Entity({ name: "CreateRawRelated" })
class CreateRawRelated {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  value!: string;

  @OneToOne(() => CreateRawWithOneToOne, "related")
  primary!: CreateRawWithOneToOne | null;
}

describe("defaultCreateRaw", () => {
  test("should include field values in document", () => {
    const entity = {
      id: "abc",
      version: 1,
      label: "Test",
      owner: null,
      ownerId: null,
    } as CreateRawItem;

    const doc = defaultCreateRaw(CreateRawItem, entity);
    expect(doc.id).toBe("abc");
    expect(doc.version).toBe(1);
    expect(doc.label).toBe("Test");
  });

  test("should skip undefined field values", () => {
    const entity = {
      id: "abc",
      label: "Test",
    } as any;

    const doc = defaultCreateRaw(CreateRawItem, entity);
    expect(doc).not.toHaveProperty("version");
  });

  test("should not include OneToMany relations in document", () => {
    const entity = {
      id: "owner-1",
      name: "Owner",
      items: [],
    } as CreateRawOwner;

    const doc = defaultCreateRaw(CreateRawOwner, entity);
    expect(doc).not.toHaveProperty("items");
  });

  test("should include FK key from ManyToOne joinKeys in document", () => {
    const relatedOwner = { id: "owner-1", name: "Owner", items: [] } as CreateRawOwner;
    const entity = {
      id: "item-1",
      version: 1,
      label: "Item",
      owner: relatedOwner,
      ownerId: "owner-1",
    } as CreateRawItem;

    const doc = defaultCreateRaw(CreateRawItem, entity);
    expect(doc.ownerId).toBe("owner-1");
  });

  test("should extract FK from related entity when joinKeys present", () => {
    const related = { id: "related-1", value: "test", primary: null } as CreateRawRelated;
    const entity = {
      id: "primary-1",
      name: "Primary",
      related,
      relatedId: undefined,
    } as any;

    const doc = defaultCreateRaw(CreateRawWithOneToOne, entity);
    // joinKeys: { relatedId: "id" } → extracts related.id into document.relatedId
    expect(doc.relatedId).toBe("related-1");
  });
});
