import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { ManyToOne } from "./ManyToOne";
import { OneToMany } from "./OneToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { RelationCount } from "./RelationCount";

@Entity({ name: "RelationCountBlog" })
class RelationCountBlog {
  @PrimaryKeyField()
  id!: string;

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
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  body!: string;

  @ManyToOne(() => RelationCountBlog, "comments")
  blog!: RelationCountBlog | null;

  blogId!: string | null;
}

describe("RelationCount", () => {
  test("should stage relationCount entry with correct key and relationKey", () => {
    const meta = getEntityMetadata(RelationCountBlog);
    const rc = meta.relationCounts.find((r) => r.key === "commentCount");
    expect(rc).toBeDefined();
    expect(rc!.key).toBe("commentCount");
    expect(rc!.relationKey).toBe("comments");
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(RelationCountBlog)).toMatchSnapshot();
  });
});
