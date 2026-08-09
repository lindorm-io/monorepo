import { describe, expect, test } from "vitest";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { Generated } from "../../../decorators/Generated.js";
import { JoinKey } from "../../../decorators/JoinKey.js";
import { ManyToOne } from "../../../decorators/ManyToOne.js";
import { OneToMany } from "../../../decorators/OneToMany.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { RelationCount } from "../../../decorators/RelationCount.js";
import { RelationId } from "../../../decorators/RelationId.js";
import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import { getEntityMetadata } from "./get-entity-metadata.js";

@Entity({ name: "VrrPost" })
class VrrPost {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string") title!: string;

  @JoinKey()
  @ManyToOne(() => VrrAuthor, "posts")
  author!: VrrAuthor | null;
}

@Entity({ name: "VrrAuthor" })
class VrrAuthor {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string") name!: string;

  @OneToMany(() => VrrPost, "author")
  posts!: Array<VrrPost>;
}

@Entity({ name: "VrrTypoRelationId" })
class VrrTypoRelationId {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @JoinKey()
  @ManyToOne(() => VrrAuthor, "posts")
  author!: VrrAuthor | null;

  @RelationId<VrrTypoRelationId>("athor" as "author")
  authorId!: string | null;
}

@Entity({ name: "VrrTypoRelationCount" })
class VrrTypoRelationCount {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @OneToMany(() => VrrPost, "author")
  posts!: Array<VrrPost>;

  @RelationCount<VrrTypoRelationCount>("post" as "posts")
  @Field("integer")
  postCount!: number;
}

describe("validateRelationReferences", () => {
  test("should resolve metadata when @RelationId names a declared relation", () => {
    expect(getEntityMetadata(VrrPost).relationIds).toEqual([]);
    expect(getEntityMetadata(VrrAuthor).relations.map((r) => r.key)).toEqual(["posts"]);
  });

  test("should throw when @RelationId names a relation that is not declared", () => {
    expect(() => getEntityMetadata(VrrTypoRelationId)).toThrow(EntityMetadataError);
    expect(() => getEntityMetadata(VrrTypoRelationId)).toThrow(
      /Relation named by @RelationId not found/,
    );
  });

  test("should name the offending property and the valid relations", () => {
    try {
      getEntityMetadata(VrrTypoRelationId);
      expect.unreachable("expected getEntityMetadata to throw");
    } catch (error: any) {
      expect(error.code).toBe("unknown_relation_reference");
      expect(error.details).toBe(
        '@RelationId on "authorId" of "VrrTypoRelationId" names relation "athor", which is not declared on this entity — name one of [author].',
      );
      expect(error.debug).toEqual({
        target: "VrrTypoRelationId",
        property: "authorId",
        relation: "athor",
      });
    }
  });

  test("should throw when @RelationCount names a relation that is not declared", () => {
    expect(() => getEntityMetadata(VrrTypoRelationCount)).toThrow(EntityMetadataError);
    expect(() => getEntityMetadata(VrrTypoRelationCount)).toThrow(
      /Relation named by @RelationCount not found/,
    );
  });
});
