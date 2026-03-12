import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinTable } from "./JoinTable";
import { ManyToMany } from "./ManyToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";

// ManyToMany: Category <-> Product

@Entity({ name: "ManyToManyProduct" })
class ManyToManyProduct {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  // Inverse side (no @JoinTable)
  @ManyToMany(() => ManyToManyCategory, "products")
  categories!: ManyToManyCategory[];
}

@Entity({ name: "ManyToManyCategory" })
class ManyToManyCategory {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  // Owning side (has @JoinTable)
  @JoinTable()
  @ManyToMany(() => ManyToManyProduct, "categories")
  products!: ManyToManyProduct[];
}

// ManyToMany with custom joinTable name
@Entity({ name: "ManyToManyTagB" })
class ManyToManyTagB {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => ManyToManyArticleB, "tags")
  articles!: ManyToManyArticleB[];
}

@Entity({ name: "ManyToManyArticleB" })
class ManyToManyArticleB {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @JoinTable({ name: "article_to_tag" })
  @ManyToMany(() => ManyToManyTagB, "articles")
  tags!: ManyToManyTagB[];
}

describe("ManyToMany", () => {
  test("should register owning side metadata", () => {
    expect(getEntityMetadata(ManyToManyCategory)).toMatchSnapshot();
  });

  test("should register inverse side metadata", () => {
    expect(getEntityMetadata(ManyToManyProduct)).toMatchSnapshot();
  });

  test("should set relation type to ManyToMany", () => {
    const meta = getEntityMetadata(ManyToManyCategory);
    const rel = meta.relations.find((r) => r.key === "products");
    expect(rel!.type).toBe("ManyToMany");
  });

  test("should resolve joinTable name (auto-generated)", () => {
    const meta = getEntityMetadata(ManyToManyCategory);
    const rel = meta.relations.find((r) => r.key === "products")!;

    expect(rel.joinTable).toBe("many_to_many_category_x_many_to_many_product");
  });

  test("should resolve joinKeys and findKeys for owning side", () => {
    const meta = getEntityMetadata(ManyToManyCategory);
    const rel = meta.relations.find((r) => r.key === "products")!;

    expect(rel.joinKeys).toEqual({ manyToManyCategoryId: "id" });
    expect(rel.findKeys).toEqual({ manyToManyCategoryId: "id" });
  });

  test("should resolve joinKeys and findKeys for inverse side", () => {
    const meta = getEntityMetadata(ManyToManyProduct);
    const rel = meta.relations.find((r) => r.key === "categories")!;

    expect(rel.joinKeys).toEqual({ manyToManyProductId: "id" });
    expect(rel.findKeys).toEqual({ manyToManyProductId: "id" });
  });

  test("should use custom joinTable name when provided", () => {
    const meta = getEntityMetadata(ManyToManyArticleB);
    const rel = meta.relations.find((r) => r.key === "tags");
    expect(rel!.joinTable).toBe("article_to_tag");
  });
});
