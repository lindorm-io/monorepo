/**
 * The document-driver half of the `@RelationCount` projection.
 *
 * A SQL driver pays one batched `COUNT(*)` per relation count; a document
 * driver counts the foreign rows once PER ENTITY, so an unnamed count is worse
 * here, not better. That the query is really skipped is asserted against a live
 * client in the sqlite sibling; what this file pins is that the document path
 * populates and skips by the same projection, on find AND on versions.
 *
 * `versions()` is covered here rather than on SQL because a versioned entity's
 * primary key is composite, and a child table referencing it is refused as a
 * foreign key mismatch — the memory driver enforces no such constraint.
 */

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, describe, expect, test } from "vitest";
import { ProteusSource } from "../../../../classes/ProteusSource.js";
import {
  CreateDateField,
  Entity,
  Field,
  Generated,
  JoinKey,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  PrimaryKeyField,
  RelationCount,
  UpdateDateField,
  VersionEndDateField,
  VersionKeyField,
  VersionStartDateField,
} from "../../../../decorators/index.js";

@Entity({ name: "MemRcAuthor" })
class MemRcAuthor {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKeyField()
  @Generated("uuid")
  versionId!: string;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @VersionStartDateField()
  versionStart!: Date;

  @VersionEndDateField()
  versionEnd!: Date | null;

  @Field("string")
  name!: string;

  @OneToMany(() => MemRcPost, "author")
  posts!: Array<MemRcPost>;

  @RelationCount<MemRcAuthor>("posts")
  @Field("integer")
  postCount!: number;
}

@Entity({ name: "MemRcPost" })
class MemRcPost {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  title!: string;

  @Field("uuid")
  authorId!: string;

  @JoinKey({ authorId: "id" })
  @ManyToOne(() => MemRcAuthor, "posts")
  author!: MemRcAuthor | null;
}

describe("MemoryRepository @RelationCount projection", () => {
  let source: ProteusSource;
  let authorId: string;

  beforeAll(async () => {
    source = new ProteusSource({
      driver: "memory",
      entities: [MemRcAuthor, MemRcPost],
      logger: createMockLogger(),
    });

    await source.connect();
    await source.setup();

    const author = await source.repository(MemRcAuthor).insert({ name: "Alice" });
    await source.repository(MemRcPost).insert({ title: "First", authorId: author.id });
    await source.repository(MemRcPost).insert({ title: "Second", authorId: author.id });

    authorId = author.id;
  });

  test("loads the count when there is no projection", async () => {
    const [author] = await source.repository(MemRcAuthor).find({ id: authorId });

    expect(author.postCount).toBe(2);
  });

  test("issues no count for a projection that does not name it", async () => {
    const [author] = await source
      .repository(MemRcAuthor)
      .find({ id: authorId }, { select: ["id", "name"] });

    expect(author.name).toBe("Alice");
    expect(author.postCount).toBeUndefined();
  });

  test("loads the count a projection named", async () => {
    const [author] = await source
      .repository(MemRcAuthor)
      .find({ id: authorId }, { select: ["id", "postCount"] });

    expect(author.postCount).toBe(2);
  });

  test("versions names the same keys find does", async () => {
    const rows = await source
      .repository(MemRcAuthor)
      .versions({ id: authorId }, { select: ["id", "postCount"] });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].postCount).toBe(2);
  });

  test("versions skips the count a projection omits", async () => {
    const rows = await source
      .repository(MemRcAuthor)
      .versions({ id: authorId }, { select: ["id", "name"] });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].postCount).toBeUndefined();
  });

  test("a cursor refuses the count", async () => {
    await expect(
      source.repository(MemRcAuthor).cursor({ select: ["id", "postCount"] }),
    ).rejects.toThrow('@RelationCount "postCount" cannot be selected on "MemRcAuthor"');
  });
});
