import { getEntityMetadata } from "./get-entity-metadata.js";
import { buildPrimaryMetadata } from "./build-primary.js";
import { resolveRelations } from "./resolve-relations.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { JoinKey } from "../../../decorators/JoinKey.js";
import { JoinTable } from "../../../decorators/JoinTable.js";
import { ManyToMany } from "../../../decorators/ManyToMany.js";
import { ManyToOne } from "../../../decorators/ManyToOne.js";
import { Nullable } from "../../../decorators/Nullable.js";
import { OneToMany } from "../../../decorators/OneToMany.js";
import { OneToOne } from "../../../decorators/OneToOne.js";
import { Generated } from "../../../decorators/Generated.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { projectColumns } from "../../utils/sync/project-columns.js";
import { resolveJoinedChildContext } from "../../utils/sync/joined-child-context.js";
import { sqliteSyncDialect } from "../../drivers/sqlite/utils/sync/sqlite-sync-dialect.js";
import { describe, expect, test } from "vitest";

/** Project just the auto-generated FK columns for an entity via the shared
 *  projection core (using the dependency-free sqlite dialect). */
const projectFkColumns = (target: Function) => {
  const metadata = getEntityMetadata(target);
  const namespaceOptions = { namespace: null };
  const child = resolveJoinedChildContext(metadata, namespaceOptions);
  return projectColumns({
    metadata,
    child,
    tableName: metadata.entity.name,
    namespace: null,
    dialect: sqliteSyncDialect,
    namespaceOptions,
  }).filter((c) => c.origin === "fk");
};

// ─────────────────────────────────────────────────────────────────────────────
// Happy path entities
// ─────────────────────────────────────────────────────────────────────────────

// OneToOne: User owns Profile (has FK)
@Entity({ name: "RRProfile" })
class RRProfile {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  bio!: string;

  @OneToOne(() => RRUser, "profile")
  user!: RRUser | null;
}

@Entity({ name: "RRUser" })
class RRUser {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @JoinKey()
  @OneToOne(() => RRProfile, "user")
  profile!: RRProfile | null;

  profileId!: string | null;
}

// OneToOne with explicit joinKeys
@Entity({ name: "RRExplicitProfile" })
class RRExplicitProfile {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  bio!: string;

  @OneToOne(() => RRExplicitUser, "profile")
  user!: RRExplicitUser | null;
}

@Entity({ name: "RRExplicitUser" })
class RRExplicitUser {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("uuid")
  profileId!: string | null;

  @JoinKey({ profileId: "id" })
  @OneToOne(() => RRExplicitProfile, "user")
  profile!: RRExplicitProfile | null;
}

// ManyToOne / OneToMany
@Entity({ name: "RRComment" })
class RRComment {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  body!: string;

  @ManyToOne(() => RRPost, "comments")
  post!: RRPost | null;

  postId!: string | null;
}

@Entity({ name: "RRPost" })
class RRPost {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  title!: string;

  @OneToMany(() => RRComment, "post")
  comments!: RRComment[];
}

// ManyToMany
@Entity({ name: "RRStudent" })
class RRStudent {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => RRCourse, "students")
  courses!: RRCourse[];
}

@Entity({ name: "RRCourse" })
class RRCourse {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @JoinTable()
  @ManyToMany(() => RRStudent, "courses")
  students!: RRStudent[];
}

// ManyToMany with custom joinTable name
@Entity({ name: "RRCustomTableTag" })
class RRCustomTableTag {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => RRCustomTableArticle, "tags")
  articles!: RRCustomTableArticle[];
}

@Entity({ name: "RRCustomTableArticle" })
class RRCustomTableArticle {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  title!: string;

  @JoinTable({ name: "article_tag_join" })
  @ManyToMany(() => RRCustomTableTag, "articles")
  tags!: RRCustomTableTag[];
}

// Self-referential ManyToMany
@Entity({ name: "RRSelfRefNode" })
class RRSelfRefNode {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @JoinTable()
  @ManyToMany(() => RRSelfRefNode, "relatedTo")
  relatedFrom!: RRSelfRefNode[];

  @ManyToMany(() => RRSelfRefNode, "relatedFrom")
  relatedTo!: RRSelfRefNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Nullable-auto-FK entities: @Nullable composes with an owning relation to make
// its auto-generated FK column nullable (no explicit @JoinKey/@Field required).
// ─────────────────────────────────────────────────────────────────────────────

// ManyToOne owning side, @Nullable on the relation, no explicit FK field.
@Entity({ name: "RRNullablePost" })
class RRNullablePost {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  title!: string;

  @OneToMany(() => RRNullableComment, "post")
  comments!: RRNullableComment[];
}

@Entity({ name: "RRNullableComment" })
class RRNullableComment {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  body!: string;

  @Nullable()
  @ManyToOne(() => RRNullablePost, "comments")
  post!: RRNullablePost | null;
}

// OneToOne owning side (@JoinKey), @Nullable on the relation, no explicit FK field.
@Entity({ name: "RRNullableProfile" })
class RRNullableProfile {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  bio!: string;

  @OneToOne(() => RRNullableAccount, "profile")
  account!: RRNullableAccount | null;
}

@Entity({ name: "RRNullableAccount" })
class RRNullableAccount {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @Nullable()
  @JoinKey()
  @OneToOne(() => RRNullableProfile, "account")
  profile!: RRNullableProfile | null;
}

// @Nullable on a non-owning @OneToMany — must throw.
@Entity({ name: "RRNullableOtmParent" })
class RRNullableOtmParent {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Nullable()
  @OneToMany(() => RRNullableOtmChild, "parent")
  children!: RRNullableOtmChild[];
}

@Entity({ name: "RRNullableOtmChild" })
class RRNullableOtmChild {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @ManyToOne(() => RRNullableOtmParent, "children")
  parent!: RRNullableOtmParent | null;

  parentId!: string | null;
}

// @Nullable on a @ManyToMany — must throw.
@Entity({ name: "RRNullableMtmA" })
class RRNullableMtmA {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Nullable()
  @JoinTable()
  @ManyToMany(() => RRNullableMtmB, "as")
  bs!: RRNullableMtmB[];
}

@Entity({ name: "RRNullableMtmB" })
class RRNullableMtmB {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @ManyToMany(() => RRNullableMtmA, "bs")
  as!: RRNullableMtmA[];
}

// @Nullable on an inverse @OneToOne (no @JoinKey — FK lives on the other side) — must throw.
@Entity({ name: "RRNullableInverseOwner" })
class RRNullableInverseOwner {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @JoinKey()
  @OneToOne(() => RRNullableInverseSide, "owner")
  side!: RRNullableInverseSide | null;

  sideId!: string | null;
}

@Entity({ name: "RRNullableInverseSide" })
class RRNullableInverseSide {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Nullable()
  @OneToOne(() => RRNullableInverseOwner, "side")
  owner!: RRNullableInverseOwner | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error path entities
// ─────────────────────────────────────────────────────────────────────────────

// Missing inverse relation
@Entity({ name: "RRNoInverseParent" })
class RRNoInverseParent {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "RRNoInverseChild" })
class RRNoInverseChild {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @ManyToOne(() => RRNoInverseParent, "children" as any)
  parent!: RRNoInverseParent | null;

  parentId!: string | null;
}

// Both OneToOne sides have @JoinKey
@Entity({ name: "RRBothJoinA" })
class RRBothJoinA {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @JoinKey()
  @OneToOne(() => RRBothJoinB, "a")
  b!: RRBothJoinB | null;

  bId!: string | null;
}

@Entity({ name: "RRBothJoinB" })
class RRBothJoinB {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @JoinKey()
  @OneToOne(() => RRBothJoinA, "b")
  a!: RRBothJoinA | null;

  aId!: string | null;
}

// ManyToMany with no join table on either side
@Entity({ name: "RRNoJoinTableA" })
class RRNoJoinTableA {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @ManyToMany(() => RRNoJoinTableB, "as")
  bs!: RRNoJoinTableB[];
}

@Entity({ name: "RRNoJoinTableB" })
class RRNoJoinTableB {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @ManyToMany(() => RRNoJoinTableA, "bs")
  as!: RRNoJoinTableA[];
}

// Join key field not found (local field doesn't exist)
@Entity({ name: "RRBadJoinKeyForeign" })
class RRBadJoinKeyForeign {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @OneToMany(() => RRBadJoinKeyOwner, "foreign")
  owners!: RRBadJoinKeyOwner[];
}

@Entity({ name: "RRBadJoinKeyOwner" })
class RRBadJoinKeyOwner {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @JoinKey({ nonExistentField: "id" })
  @ManyToOne(() => RRBadJoinKeyForeign, "owners")
  foreign!: RRBadJoinKeyForeign | null;
}

// Foreign join key field not found (foreign field doesn't exist)
@Entity({ name: "RRBadForeignJoinForeign" })
class RRBadForeignJoinForeign {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @OneToMany(() => RRBadForeignJoinOwner, "foreign")
  owners!: RRBadForeignJoinOwner[];
}

@Entity({ name: "RRBadForeignJoinOwner" })
class RRBadForeignJoinOwner {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Nullable()
  @Field("uuid")
  foreignId!: string | null;

  @JoinKey({ foreignId: "nonExistent" })
  @ManyToOne(() => RRBadForeignJoinForeign, "owners")
  foreign!: RRBadForeignJoinForeign | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveRelations", () => {
  describe("OneToOne", () => {
    test("should resolve owning side with calculated joinKeys and findKeys", () => {
      const meta = getEntityMetadata(RRUser);
      const rel = meta.relations.find((r) => r.key === "profile")!;

      expect(rel.type).toBe("OneToOne");
      expect(rel.joinKeys).toEqual({ profileId: "id" });
      expect(rel.findKeys).toEqual({ id: "profileId" });
      expect(rel.joinTable).toBeNull();
    });

    test("should resolve inverse side with null joinKeys and calculated findKeys", () => {
      const meta = getEntityMetadata(RRProfile);
      const rel = meta.relations.find((r) => r.key === "user")!;

      expect(rel.type).toBe("OneToOne");
      expect(rel.joinKeys).toBeNull();
      expect(rel.findKeys).toEqual({ profileId: "id" });
      expect(rel.joinTable).toBeNull();
    });

    test("should resolve with explicit joinKeys dict", () => {
      const meta = getEntityMetadata(RRExplicitUser);
      const rel = meta.relations.find((r) => r.key === "profile")!;

      expect(rel.type).toBe("OneToOne");
      expect(rel.joinKeys).toEqual({ profileId: "id" });
      expect(rel.findKeys).toEqual({ id: "profileId" });
    });

    test("should throw when both sides have joinKeys", () => {
      expect(() => getEntityMetadata(RRBothJoinA)).toThrow(
        "Join keys cannot be set on both decorators",
      );
    });
  });

  describe("ManyToOne / OneToMany", () => {
    test("should resolve ManyToOne with calculated joinKeys and findKeys", () => {
      const meta = getEntityMetadata(RRComment);
      const rel = meta.relations.find((r) => r.key === "post")!;

      expect(rel.type).toBe("ManyToOne");
      expect(rel.joinKeys).toEqual({ postId: "id" });
      expect(rel.findKeys).toEqual({ id: "postId" });
      expect(rel.joinTable).toBeNull();
    });

    test("should resolve OneToMany with null joinKeys and foreign-derived findKeys", () => {
      const meta = getEntityMetadata(RRPost);
      const rel = meta.relations.find((r) => r.key === "comments")!;

      expect(rel.type).toBe("OneToMany");
      expect(rel.joinKeys).toBeNull();
      expect(rel.findKeys).toEqual({ postId: "id" });
      expect(rel.joinTable).toBeNull();
    });
  });

  describe("ManyToMany", () => {
    test("should resolve owning side with generated joinKeys and joinTable", () => {
      const meta = getEntityMetadata(RRCourse);
      const rel = meta.relations.find((r) => r.key === "students")!;

      expect(rel.type).toBe("ManyToMany");
      expect(rel.joinKeys).toEqual({ rrCourseId: "id" });
      expect(rel.findKeys).toEqual({ rrCourseId: "id" });
      expect(rel.joinTable).toBe("rr_course_x_rr_student");
    });

    test("should resolve inverse side with generated joinKeys and shared joinTable", () => {
      const meta = getEntityMetadata(RRStudent);
      const rel = meta.relations.find((r) => r.key === "courses")!;

      expect(rel.type).toBe("ManyToMany");
      expect(rel.joinKeys).toEqual({ rrStudentId: "id" });
      expect(rel.findKeys).toEqual({ rrStudentId: "id" });
      expect(rel.joinTable).toBe("rr_course_x_rr_student");
    });

    test("should use custom joinTable name when provided", () => {
      const meta = getEntityMetadata(RRCustomTableArticle);
      const rel = meta.relations.find((r) => r.key === "tags")!;

      expect(rel.joinTable).toBe("article_tag_join");
    });

    test("should propagate custom joinTable to inverse side", () => {
      const meta = getEntityMetadata(RRCustomTableTag);
      const rel = meta.relations.find((r) => r.key === "articles")!;

      expect(rel.joinTable).toBe("article_tag_join");
    });

    test("should throw when no joinTable on either side", () => {
      expect(() => getEntityMetadata(RRNoJoinTableA)).toThrow("Join table not found");
    });
  });

  describe("self-referential ManyToMany", () => {
    test("should resolve owning side with source findKeys", () => {
      const meta = getEntityMetadata(RRSelfRefNode);
      const rel = meta.relations.find((r) => r.key === "relatedFrom")!;

      expect(rel.type).toBe("ManyToMany");
      expect(rel.joinKeys).toEqual({
        sourceRrSelfRefNodeId: "id",
        targetRrSelfRefNodeId: "id",
      });
      expect(rel.findKeys).toEqual({ sourceRrSelfRefNodeId: "id" });
      expect(rel.joinTable).toBe("rr_self_ref_node_x_rr_self_ref_node");
    });

    test("should resolve inverse side with target findKeys", () => {
      const meta = getEntityMetadata(RRSelfRefNode);
      const rel = meta.relations.find((r) => r.key === "relatedTo")!;

      expect(rel.type).toBe("ManyToMany");
      expect(rel.joinKeys).toEqual({
        sourceRrSelfRefNodeId: "id",
        targetRrSelfRefNodeId: "id",
      });
      expect(rel.findKeys).toEqual({ targetRrSelfRefNodeId: "id" });
      expect(rel.joinTable).toBe("rr_self_ref_node_x_rr_self_ref_node");
    });
  });

  describe("error paths", () => {
    test("should throw when foreign relation not found", () => {
      expect(() => getEntityMetadata(RRNoInverseChild)).toThrow(
        "Foreign relation metadata not found",
      );
    });

    test("should throw when join key field not found on local entity", () => {
      expect(() => getEntityMetadata(RRBadJoinKeyOwner)).toThrow(
        "Join key field not found",
      );
    });

    test("should throw when foreign join key field not found", () => {
      expect(() => getEntityMetadata(RRBadForeignJoinOwner)).toThrow(
        "Foreign join key field not found",
      );
    });
  });

  describe("nullable auto-FK (@Nullable composes with owning relation)", () => {
    test("@Nullable @ManyToOne sets relation.options.nullable true", () => {
      const meta = getEntityMetadata(RRNullableComment);
      const rel = meta.relations.find((r) => r.key === "post")!;

      expect(rel.type).toBe("ManyToOne");
      expect(rel.options.nullable).toBe(true);
    });

    test("@Nullable @ManyToOne projects a nullable auto-FK column", () => {
      const fkColumns = projectFkColumns(RRNullableComment);

      expect(fkColumns).toHaveLength(1);
      expect(fkColumns[0].nullable).toBe(true);
    });

    test("@Nullable @OneToOne (owning) sets relation.options.nullable true", () => {
      const meta = getEntityMetadata(RRNullableAccount);
      const rel = meta.relations.find((r) => r.key === "profile")!;

      expect(rel.type).toBe("OneToOne");
      expect(rel.joinKeys).not.toBeNull();
      expect(rel.options.nullable).toBe(true);
    });

    test("@Nullable @OneToOne (owning) projects a nullable auto-FK column", () => {
      const fkColumns = projectFkColumns(RRNullableAccount);

      expect(fkColumns).toHaveLength(1);
      expect(fkColumns[0].nullable).toBe(true);
    });

    test("a plain (non-nullable) relation keeps options.nullable false", () => {
      const meta = getEntityMetadata(RRComment);
      const rel = meta.relations.find((r) => r.key === "post")!;

      expect(rel.options.nullable).toBe(false);
    });

    test("a plain (non-nullable) relation projects a NOT NULL auto-FK column", () => {
      const fkColumns = projectFkColumns(RRComment);

      expect(fkColumns).toHaveLength(1);
      expect(fkColumns[0].nullable).toBe(false);
    });

    test("@Nullable on @OneToMany throws (non-owning relation)", () => {
      expect(() => getEntityMetadata(RRNullableOtmParent)).toThrow(
        /@Nullable on relation "children" requires an owning-side foreign-key column/,
      );
    });

    test("@Nullable on @ManyToMany throws (non-owning relation)", () => {
      expect(() => getEntityMetadata(RRNullableMtmA)).toThrow(
        /@Nullable on relation "bs" requires an owning-side foreign-key column/,
      );
    });

    test("@Nullable on an inverse @OneToOne (no @JoinKey) throws", () => {
      expect(() => getEntityMetadata(RRNullableInverseSide)).toThrow(
        /@Nullable on relation "owner" requires an owning-side foreign-key column/,
      );
    });
  });

  describe("resolveRelations (direct call)", () => {
    test("should return empty array when entity has no relations", () => {
      const primaryMeta = buildPrimaryMetadata(RRNoInverseParent);
      const relations = resolveRelations(RRNoInverseParent, primaryMeta);
      expect(relations).toEqual([]);
    });

    test("should spread-copy staged relations (not mutate originals)", () => {
      const primaryMeta = buildPrimaryMetadata(RRPost);
      const first = resolveRelations(RRPost, primaryMeta);
      const second = resolveRelations(RRPost, primaryMeta);

      expect(first[0]).not.toBe(second[0]);
      expect(first[0].findKeys).toEqual(second[0].findKeys);
    });

    test("should deep-clone options (not share reference with staged metadata)", () => {
      const primaryMeta = buildPrimaryMetadata(RRPost);
      const first = resolveRelations(RRPost, primaryMeta);
      const second = resolveRelations(RRPost, primaryMeta);

      // Options objects should not be the same reference
      expect(first[0].options).not.toBe(second[0].options);
      // But should have the same values
      expect(first[0].options).toEqual(second[0].options);
    });
  });
});
