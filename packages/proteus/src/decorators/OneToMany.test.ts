import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Eager } from "./Eager.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { ManyToOne } from "./ManyToOne.js";
import { OneToMany } from "./OneToMany.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "OneToManyComment" })
class OneToManyComment {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  body!: string;

  @Eager()
  @ManyToOne(() => OneToManyPost, "comments")
  post!: OneToManyPost | null;

  postId!: string | null;
}

@Entity({ name: "OneToManyPost" })
class OneToManyPost {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @Eager()
  @OneToMany(() => OneToManyComment, "post")
  comments!: OneToManyComment[];
}

describe("OneToMany", () => {
  test("should register parent entity with OneToMany metadata", () => {
    expect(getEntityMetadata(OneToManyPost)).toMatchSnapshot();
  });

  test("should set relation type to OneToMany", () => {
    const meta = getEntityMetadata(OneToManyPost);
    const rel = meta.relations.find((r) => r.key === "comments");
    expect(rel!.type).toBe("OneToMany");
  });

  test("should not have joinKeys on OneToMany side", () => {
    const meta = getEntityMetadata(OneToManyPost);
    const rel = meta.relations.find((r) => r.key === "comments");
    expect(rel!.joinKeys).toBeNull();
  });

  test("should resolve findKeys for OneToMany (pointing to ManyToOne FK)", () => {
    const meta = getEntityMetadata(OneToManyPost);
    const rel = meta.relations.find((r) => r.key === "comments");
    expect(rel!.findKeys).toBeDefined();
    expect(Object.values(rel!.findKeys!)).toContain("id");
  });
});
