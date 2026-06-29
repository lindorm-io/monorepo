import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Default } from "./Default.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { ManyToOne } from "./ManyToOne.js";
import { OneToMany } from "./OneToMany.js";
import { Generated } from "./Generated.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { RelationCount } from "./RelationCount.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "RelationCountBlog" })
class RelationCountBlog {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  title!: string;

  @OneToMany(() => RelationCountComment, "blog")
  comments!: RelationCountComment[];

  @RelationCount<RelationCountBlog>("comments")
  @Field("integer")
  commentCount!: number;
}

@Entity({ name: "RelationCountComment" })
class RelationCountComment {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  body!: string;

  @ManyToOne(() => RelationCountBlog, "comments")
  blog!: RelationCountBlog | null;

  blogId!: string | null;
}

@Entity({ name: "RelationCountDefaulted" })
class RelationCountDefaulted {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @OneToMany(() => RelationCountComment, "blog")
  comments!: RelationCountComment[];

  // Explicit default must be preserved (not overwritten with 0).
  @RelationCount<RelationCountDefaulted>("comments")
  @Default(7)
  @Field("integer")
  commentCount!: number;
}

describe("RelationCount", () => {
  test("should stage relationCount entry with correct key and relationKey", () => {
    const meta = getEntityMetadata(RelationCountBlog);
    const rc = meta.relationCounts.find((r) => r.key === "commentCount");
    expect(rc).toBeDefined();
    expect(rc!.key).toBe("commentCount");
    expect(rc!.relationKey).toBe("comments");
  });

  test("should default the backing column to 0 so inserts don't violate NOT NULL (F11)", () => {
    const meta = getEntityMetadata(RelationCountBlog);
    const field = meta.fields.find((f) => f.key === "commentCount");
    expect(field).toBeDefined();
    expect(field!.default).toBe(0);
  });

  test("should preserve an explicit @Default on a relation-count field", () => {
    const meta = getEntityMetadata(RelationCountDefaulted);
    const field = meta.fields.find((f) => f.key === "commentCount");
    expect(field!.default).toBe(7);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(RelationCountBlog)).toMatchSnapshot();
  });
});
