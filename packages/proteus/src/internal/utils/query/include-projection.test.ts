import { describe, expect, test } from "vitest";
import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata.js";
import type { IncludeSpec } from "../../types/query.js";
import { makeField } from "../../__fixtures__/make-field.js";
import {
  clearImplicitKeys,
  includeProjection,
  joinStitchKeys,
  queryStitchKeys,
  restrictToProjection,
} from "./include-projection.js";

class Post {
  id: string = "";
  title: string = "";
  body: string | null = null;
  authorId: string | null = null;
}

const authorRelation = {
  key: "author",
  type: "ManyToOne",
  findKeys: { authorId: "id" },
  joinKeys: { author_id: "id" },
  joinTable: null,
  orderBy: null,
} as unknown as MetaRelation;

const postMetadata = {
  entity: { name: "posts", namespace: null },
  target: Post,
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title"),
    makeField("body", { nullable: true }),
    makeField("authorId", { type: "uuid", name: "author_id", nullable: true }),
  ],
  inheritance: null,
  primaryKeys: ["id"],
  relations: [authorRelation],
  relationIds: [],
} as unknown as EntityMetadata;

/** OneToMany author → posts: the FK sits on the foreign (post) table. */
const postsRelation = {
  key: "posts",
  type: "OneToMany",
  findKeys: { author_id: "id" },
  joinKeys: null,
  joinTable: null,
  orderBy: null,
} as unknown as MetaRelation;

/** ManyToOne post → author: the FK sits on the root (post) table. */
const ownedRelation = {
  key: "author",
  type: "ManyToOne",
  findKeys: { id: "authorId" },
  joinKeys: { author_id: "id" },
  joinTable: null,
  orderBy: null,
} as unknown as MetaRelation;

const manyToManyRelation = {
  key: "tags",
  type: "ManyToMany",
  findKeys: { post_id: "id" },
  joinKeys: { post_id: "id" },
  joinTable: "post_x_tag",
  orderBy: null,
} as unknown as MetaRelation;

const makeInclude = (select: Array<string> | null): IncludeSpec => ({
  relation: "posts",
  required: false,
  strategy: "join",
  select,
  where: null,
});

describe("includeProjection", () => {
  test("returns null when the caller named no columns", () => {
    expect(
      includeProjection(makeInclude(null), postsRelation, postMetadata, joinStitchKeys),
    ).toBeNull();
  });

  test("never consults the stitch keys when the caller named no columns", () => {
    expect(() =>
      includeProjection(makeInclude(null), postsRelation, postMetadata, () => {
        throw new Error("stitch keys resolved");
      }),
    ).not.toThrow();
  });

  test("adds the foreign primary key to a join projection and marks it implicit", () => {
    const projection = includeProjection(
      makeInclude(["title"]),
      postsRelation,
      postMetadata,
      joinStitchKeys,
    );

    expect(projection).toEqual({ keys: ["title", "id"], implicit: ["id", "authorId"] });
  });

  test("keeps a stitching key the caller named out of the implicit set", () => {
    const projection = includeProjection(
      makeInclude(["id", "title"]),
      postsRelation,
      postMetadata,
      joinStitchKeys,
    );

    expect(projection).toEqual({ keys: ["id", "title"], implicit: ["authorId"] });
  });

  test("adds the inverse foreign key to a query projection by its property key", () => {
    const projection = includeProjection(
      makeInclude(["title"]),
      postsRelation,
      postMetadata,
      queryStitchKeys,
    );

    // findKeys names the physical column `author_id`; the entity carries it as
    // `authorId`, which is what has to be cleared off again.
    expect(projection).toEqual({ keys: ["title", "authorId"], implicit: ["authorId"] });
  });

  test("adds the foreign primary key to an owning query projection", () => {
    const projection = includeProjection(
      makeInclude(["title"]),
      ownedRelation,
      postMetadata,
      queryStitchKeys,
    );

    expect(projection).toEqual({ keys: ["title", "id"], implicit: ["id", "authorId"] });
  });

  test("asks the foreign table for nothing on a many-to-many query projection", () => {
    const projection = includeProjection(
      makeInclude(["title"]),
      manyToManyRelation,
      postMetadata,
      queryStitchKeys,
    );

    expect(projection).toEqual({ keys: ["title"], implicit: ["authorId"] });
  });

  test("adds an @OrderBy column to a join projection", () => {
    const ordered = { ...postsRelation, orderBy: { title: "ASC" } } as MetaRelation;

    const projection = includeProjection(
      makeInclude(["body"]),
      ordered,
      postMetadata,
      joinStitchKeys,
    );

    expect(projection).toEqual({
      keys: ["body", "id", "title"],
      implicit: ["id", "title", "authorId"],
    });
  });

  test("adds the discriminator of a polymorphic relation target", () => {
    const polymorphic = {
      ...postMetadata,
      inheritance: { discriminatorField: "kind" },
    } as unknown as EntityMetadata;

    const projection = includeProjection(
      makeInclude(["title"]),
      postsRelation,
      polymorphic,
      joinStitchKeys,
    );

    expect(projection!.keys).toEqual(["title", "id", "kind"]);
  });
});

describe("restrictToProjection", () => {
  test("hands back the metadata untouched when there is no projection", () => {
    expect(restrictToProjection(postMetadata, null)).toBe(postMetadata);
  });

  test("keeps only the projected fields", () => {
    const projection = includeProjection(
      makeInclude(["title"]),
      postsRelation,
      postMetadata,
      joinStitchKeys,
    );

    expect(
      restrictToProjection(postMetadata, projection).fields.map((f) => f.key),
    ).toEqual(["id", "title"]);
  });
});

describe("clearImplicitKeys", () => {
  test("clears the keys the caller did not name", () => {
    const projection = includeProjection(
      makeInclude(["title"]),
      postsRelation,
      postMetadata,
      queryStitchKeys,
    );

    const post = new Post();
    post.title = "Hello";
    post.authorId = "author-1";

    clearImplicitKeys(post, projection);

    expect(post.title).toBe("Hello");
    expect(post.authorId).toBeUndefined();
    expect("authorId" in post).toBe(false);
  });

  test("leaves an entity alone when there is no projection", () => {
    const post = new Post();
    post.authorId = "author-1";

    clearImplicitKeys(post, null);

    expect(post.authorId).toBe("author-1");
  });
});
