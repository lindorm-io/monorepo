import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Eager } from "./Eager";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinKey } from "./JoinKey";
import { ManyToOne } from "./ManyToOne";
import { OneToMany } from "./OneToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "EagerAuthor" })
class EagerAuthor {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => EagerPost, "author")
  posts!: EagerPost[];

  @OneToMany(() => EagerSinglePost, "author")
  singlePosts!: EagerSinglePost[];

  @OneToMany(() => EagerMultiplePost, "author")
  multiplePosts!: EagerMultiplePost[];
}

@Entity({ name: "EagerPost" })
class EagerPost {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @Eager()
  @JoinKey()
  @ManyToOne(() => EagerAuthor, "posts")
  author!: EagerAuthor | null;

  authorId!: string | null;
}

@Entity({ name: "EagerSinglePost" })
class EagerSinglePost {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @Eager("single")
  @JoinKey()
  @ManyToOne(() => EagerAuthor, "singlePosts")
  author!: EagerAuthor | null;

  authorId!: string | null;
}

@Entity({ name: "EagerMultiplePost" })
class EagerMultiplePost {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @Eager("multiple")
  @JoinKey()
  @ManyToOne(() => EagerAuthor, "multiplePosts")
  author!: EagerAuthor | null;

  authorId!: string | null;
}

describe("Eager", () => {
  test("should set loading to eager for both scopes when no scope provided", () => {
    const meta = getEntityMetadata(EagerPost);
    const rel = meta.relations.find((r) => r.key === "author")!;
    expect(rel.options.loading.single).toBe("eager");
    expect(rel.options.loading.multiple).toBe("eager");
  });

  test("should set loading to eager for single scope only", () => {
    const meta = getEntityMetadata(EagerSinglePost);
    const rel = meta.relations.find((r) => r.key === "author")!;
    expect(rel.options.loading.single).toBe("eager");
    expect(rel.options.loading.multiple).toBe("ignore");
  });

  test("should set loading to eager for multiple scope only", () => {
    const meta = getEntityMetadata(EagerMultiplePost);
    const rel = meta.relations.find((r) => r.key === "author")!;
    expect(rel.options.loading.single).toBe("ignore");
    expect(rel.options.loading.multiple).toBe("eager");
  });

  test("should match snapshot for eager on both scopes", () => {
    expect(getEntityMetadata(EagerPost)).toMatchSnapshot();
  });
});
