import { getEntityMetadata } from "./get-entity-metadata.js";
import { Check } from "../../../decorators/Check.js";
import { CreateDateField } from "../../../decorators/CreateDateField.js";
import { Default } from "../../../decorators/Default.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { Generated } from "../../../decorators/Generated.js";
import { Index } from "../../../decorators/Index_.js";
import { ManyToOne } from "../../../decorators/ManyToOne.js";
import { OnCreate } from "../../../decorators/OnCreate.js";
import { OneToMany } from "../../../decorators/OneToMany.js";
import { PrimaryKey } from "../../../decorators/PrimaryKey.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { UpdateDateField } from "../../../decorators/UpdateDateField.js";
import { VersionField } from "../../../decorators/VersionField.js";
import { describe, expect, test, vi } from "vitest";

@Entity({ name: "GetMetadataSimple" })
class GetMetadataSimple {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @Field("string")
  name!: string;
}

@Entity({ name: "GetMetadataParent" })
class GetMetadataParent {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "GetMetadataChild" })
class GetMetadataChild extends GetMetadataParent {
  @Field("string")
  extra!: string;
}

class NotAnEntity {
  id!: string;
}

// Dedicated class for caching test — only used in that test
@Entity({ name: "GetMetadataCacheOnly" })
class GetMetadataCacheOnly {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  value!: string;
}

// E2E pipeline test entities
const e2eOnCreateCb = vi.fn();

@Entity({ name: "E2EComment" })
class E2EComment {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  body!: string;

  @ManyToOne(() => E2EPost, "comments")
  post!: E2EPost | null;

  postId!: string | null;
}

@Entity({ name: "E2EPost" })
@OnCreate(e2eOnCreateCb)
@Check("views >= 0", { name: "views_positive" })
@Index<typeof E2EPost>(["title"])
class E2EPost {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  title!: string;

  @Default(0)
  @Field("integer")
  views!: number;

  @OneToMany(() => E2EComment, "post")
  comments!: E2EComment[];
}

describe("getEntityMetadata", () => {
  test("should return full entity metadata snapshot", () => {
    expect(getEntityMetadata(GetMetadataSimple)).toMatchSnapshot();
  });

  test("should return metadata with correct target reference", () => {
    const meta = getEntityMetadata(GetMetadataSimple);
    expect(meta.target).toBe(GetMetadataSimple);
  });

  test("should include inherited fields in child entity", () => {
    const meta = getEntityMetadata(GetMetadataChild);
    expect(meta.fields.some((f) => f.key === "id")).toBe(true);
    expect(meta.fields.some((f) => f.key === "extra")).toBe(true);
  });

  test("should cache metadata on second call (dedicated class)", () => {
    const first = getEntityMetadata(GetMetadataCacheOnly);
    const second = getEntityMetadata(GetMetadataCacheOnly);
    expect(first).toBe(second);
  });

  test("should throw when entity metadata not found", () => {
    expect(() => getEntityMetadata(NotAnEntity)).toThrow("Entity metadata not found");
  });

  test("should include empty relations array when no relations", () => {
    const meta = getEntityMetadata(GetMetadataSimple);
    expect(meta.relations).toEqual([]);
  });
});

describe("getEntityMetadata (full pipeline)", () => {
  test("should produce complete metadata for entity with relations, hooks, checks, and indexes", () => {
    const meta = getEntityMetadata(E2EPost);

    // Entity identity
    expect(meta.target).toBe(E2EPost);
    expect(meta.entity.name).toBe("E2EPost");

    // Primary keys
    expect(meta.primaryKeys).toEqual(["id"]);

    // Generated fields
    expect(meta.generated).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "id", strategy: "uuid" })]),
    );

    // Fields include all declared fields
    const fieldKeys = meta.fields.map((f) => f.key);
    expect(fieldKeys).toEqual(
      expect.arrayContaining([
        "id",
        "version",
        "createdAt",
        "updatedAt",
        "title",
        "views",
      ]),
    );

    // Default values
    const viewsField = meta.fields.find((f) => f.key === "views")!;
    expect(viewsField.default).toBe(0);
    expect(viewsField.type).toBe("integer");

    // Hooks
    const onCreateHooks = meta.hooks.filter((h) => h.decorator === "OnCreate");
    expect(onCreateHooks).toHaveLength(1);
    expect(onCreateHooks[0].callback).toBe(e2eOnCreateCb);

    // Checks
    expect(meta.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ expression: "views >= 0", name: "views_positive" }),
      ]),
    );

    // Indexes (include auto-indexes + explicit)
    const titleIndex = meta.indexes.find((i) => i.keys.some((k) => k.key === "title"));
    expect(titleIndex).toBeDefined();

    // Relations
    expect(meta.relations).toHaveLength(1);
    const commentsRel = meta.relations[0];
    expect(commentsRel.key).toBe("comments");
    expect(commentsRel.type).toBe("OneToMany");
    expect(commentsRel.foreignKey).toBe("post");
    expect(commentsRel.joinKeys).toBeNull();
    expect(commentsRel.findKeys).toEqual({ postId: "id" });
  });

  test("should produce complete metadata for child entity with foreign key relation", () => {
    const meta = getEntityMetadata(E2EComment);

    expect(meta.target).toBe(E2EComment);
    expect(meta.entity.name).toBe("E2EComment");
    expect(meta.primaryKeys).toEqual(["id"]);

    // ManyToOne relation
    expect(meta.relations).toHaveLength(1);
    const postRel = meta.relations[0];
    expect(postRel.key).toBe("post");
    expect(postRel.type).toBe("ManyToOne");
    expect(postRel.foreignKey).toBe("comments");
    expect(postRel.joinKeys).toEqual({ postId: "id" });
    expect(postRel.findKeys).toEqual({ id: "postId" });
  });
});
