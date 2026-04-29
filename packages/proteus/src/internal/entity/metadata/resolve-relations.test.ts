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
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Happy path entities
// ─────────────────────────────────────────────────────────────────────────────

// OneToOne: User owns Profile (has FK)
@Entity({ name: "RRProfile" })
class RRProfile {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  bio!: string;

  @OneToOne(() => RRUser, "profile")
  user!: RRUser | null;
}

@Entity({ name: "RRUser" })
class RRUser {
  @PrimaryKeyField()
  id!: string;

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
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  bio!: string;

  @OneToOne(() => RRExplicitUser, "profile")
  user!: RRExplicitUser | null;
}

@Entity({ name: "RRExplicitUser" })
class RRExplicitUser {
  @PrimaryKeyField()
  id!: string;

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
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  body!: string;

  @ManyToOne(() => RRPost, "comments")
  post!: RRPost | null;

  postId!: string | null;
}

@Entity({ name: "RRPost" })
class RRPost {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @OneToMany(() => RRComment, "post")
  comments!: RRComment[];
}

// ManyToMany
@Entity({ name: "RRStudent" })
class RRStudent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => RRCourse, "students")
  courses!: RRCourse[];
}

@Entity({ name: "RRCourse" })
class RRCourse {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @JoinTable()
  @ManyToMany(() => RRStudent, "courses")
  students!: RRStudent[];
}

// ManyToMany with custom joinTable name
@Entity({ name: "RRCustomTableTag" })
class RRCustomTableTag {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => RRCustomTableArticle, "tags")
  articles!: RRCustomTableArticle[];
}

@Entity({ name: "RRCustomTableArticle" })
class RRCustomTableArticle {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @JoinTable({ name: "article_tag_join" })
  @ManyToMany(() => RRCustomTableTag, "articles")
  tags!: RRCustomTableTag[];
}

// Self-referential ManyToMany
@Entity({ name: "RRSelfRefNode" })
class RRSelfRefNode {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @JoinTable()
  @ManyToMany(() => RRSelfRefNode, "relatedTo")
  relatedFrom!: RRSelfRefNode[];

  @ManyToMany(() => RRSelfRefNode, "relatedFrom")
  relatedTo!: RRSelfRefNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Error path entities
// ─────────────────────────────────────────────────────────────────────────────

// Missing inverse relation
@Entity({ name: "RRNoInverseParent" })
class RRNoInverseParent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "RRNoInverseChild" })
class RRNoInverseChild {
  @PrimaryKeyField()
  id!: string;

  @ManyToOne(() => RRNoInverseParent, "children" as any)
  parent!: RRNoInverseParent | null;

  parentId!: string | null;
}

// Both OneToOne sides have @JoinKey
@Entity({ name: "RRBothJoinA" })
class RRBothJoinA {
  @PrimaryKeyField()
  id!: string;

  @JoinKey()
  @OneToOne(() => RRBothJoinB, "a")
  b!: RRBothJoinB | null;

  bId!: string | null;
}

@Entity({ name: "RRBothJoinB" })
class RRBothJoinB {
  @PrimaryKeyField()
  id!: string;

  @JoinKey()
  @OneToOne(() => RRBothJoinA, "b")
  a!: RRBothJoinA | null;

  aId!: string | null;
}

// ManyToMany with no join table on either side
@Entity({ name: "RRNoJoinTableA" })
class RRNoJoinTableA {
  @PrimaryKeyField()
  id!: string;

  @ManyToMany(() => RRNoJoinTableB, "as")
  bs!: RRNoJoinTableB[];
}

@Entity({ name: "RRNoJoinTableB" })
class RRNoJoinTableB {
  @PrimaryKeyField()
  id!: string;

  @ManyToMany(() => RRNoJoinTableA, "bs")
  as!: RRNoJoinTableA[];
}

// Join key field not found (local field doesn't exist)
@Entity({ name: "RRBadJoinKeyForeign" })
class RRBadJoinKeyForeign {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => RRBadJoinKeyOwner, "foreign")
  owners!: RRBadJoinKeyOwner[];
}

@Entity({ name: "RRBadJoinKeyOwner" })
class RRBadJoinKeyOwner {
  @PrimaryKeyField()
  id!: string;

  @JoinKey({ nonExistentField: "id" })
  @ManyToOne(() => RRBadJoinKeyForeign, "owners")
  foreign!: RRBadJoinKeyForeign | null;
}

// Foreign join key field not found (foreign field doesn't exist)
@Entity({ name: "RRBadForeignJoinForeign" })
class RRBadForeignJoinForeign {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => RRBadForeignJoinOwner, "foreign")
  owners!: RRBadForeignJoinOwner[];
}

@Entity({ name: "RRBadForeignJoinOwner" })
class RRBadForeignJoinOwner {
  @PrimaryKeyField()
  id!: string;

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
