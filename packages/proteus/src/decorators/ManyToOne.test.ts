import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Eager } from "./Eager.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { JoinKey } from "./JoinKey.js";
import { ManyToOne } from "./ManyToOne.js";
import { Nullable } from "./Nullable.js";
import { OneToMany } from "./OneToMany.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "ManyToOneTag" })
class ManyToOneTag {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => ManyToOneItem, "tag")
  items!: ManyToOneItem[];
}

@Entity({ name: "ManyToOneItem" })
class ManyToOneItem {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  label!: string;

  @Eager()
  @ManyToOne(() => ManyToOneTag, "items")
  tag!: ManyToOneTag | null;

  @Nullable()
  @Field("uuid")
  tagId!: string | null;
}

// ManyToOne with explicit joinKeys
@Entity({ name: "ManyToOneExplicitCategory" })
class ManyToOneExplicitCategory {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => ManyToOneExplicitProduct, "category")
  products!: ManyToOneExplicitProduct[];
}

@Entity({ name: "ManyToOneExplicitProduct" })
class ManyToOneExplicitProduct {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @Nullable()
  @Field("uuid")
  categoryId!: string | null;

  @JoinKey({ categoryId: "id" })
  @ManyToOne(() => ManyToOneExplicitCategory, "products")
  category!: ManyToOneExplicitCategory | null;
}

describe("ManyToOne", () => {
  test("should register ManyToOne metadata on child entity", () => {
    expect(getEntityMetadata(ManyToOneItem)).toMatchSnapshot();
  });

  test("should set relation type to ManyToOne", () => {
    const meta = getEntityMetadata(ManyToOneItem);
    const rel = meta.relations.find((r) => r.key === "tag");
    expect(rel!.type).toBe("ManyToOne");
  });

  test("should resolve joinKeys for ManyToOne side (owning)", () => {
    const meta = getEntityMetadata(ManyToOneItem);
    const rel = meta.relations.find((r) => r.key === "tag")!;

    expect(rel.joinKeys).toEqual({ tagId: "id" });
  });

  test("should resolve findKeys for ManyToOne (reversed joinKeys)", () => {
    const meta = getEntityMetadata(ManyToOneItem);
    const rel = meta.relations.find((r) => r.key === "tag")!;

    // findKeys = reverseDictValues(joinKeys): { id: "tagId" }
    expect(rel.findKeys).toEqual({ id: "tagId" });
  });

  test("should register with explicit joinKeys", () => {
    expect(getEntityMetadata(ManyToOneExplicitProduct)).toMatchSnapshot();
  });
});
