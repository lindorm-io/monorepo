/**
 * A projection decides which `@RelationId` properties are loaded.
 *
 * An owning `*ToOne` relationId rides along on a FK column that was fetched
 * anyway, but an inverse one — `OneToMany` here — costs its own SELECT against
 * the foreign table. Asserting only that the property is absent would pass on
 * an implementation that still ran the query and threw the answer away, so the
 * queries themselves are counted off the live client.
 */

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { ProteusSource } from "../../../../classes/ProteusSource.js";
import {
  Entity,
  Field,
  Generated,
  JoinKey,
  ManyToOne,
  OneToMany,
  PrimaryKeyField,
  RelationId,
} from "../../../../decorators/index.js";
import type { SqliteQueryClient, SqliteRow } from "../types/sqlite-query-client.js";

@Entity({ name: "RiProjAuthor" })
class RiProjAuthor {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => RiProjPost, "author")
  posts!: Array<RiProjPost>;

  @RelationId<RiProjAuthor>("posts")
  postIds!: Array<string>;
}

@Entity({ name: "RiProjPost" })
class RiProjPost {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  title!: string;

  @Field("uuid")
  authorId!: string;

  @JoinKey({ authorId: "id" })
  @ManyToOne(() => RiProjAuthor, "posts")
  author!: RiProjAuthor | null;
}

describe("SqliteRepository @RelationId projection", () => {
  const filename = join(tmpdir(), `proteus-riproj-${randomUUID()}.db`);

  let source: ProteusSource;
  let foreignQueries: Array<string>;
  let authorId: string;
  let postIds: Array<string>;

  beforeAll(async () => {
    source = new ProteusSource({
      driver: "sqlite",
      filename,
      entities: [RiProjAuthor, RiProjPost],
      logger: createMockLogger(),
      synchronize: true,
    });

    await source.connect();
    await source.setup();

    // Count every read of the foreign table, whoever issues it.
    const client = await source.client<SqliteQueryClient>();
    const all = client.all.bind(client);
    client.all = (sql: string, params?: ReadonlyArray<unknown>): Array<SqliteRow> => {
      if (sql.includes(`FROM "RiProjPost"`)) foreignQueries.push(sql);
      return all(sql, params);
    };

    const authors = source.repository(RiProjAuthor);
    const posts = source.repository(RiProjPost);

    const author = await authors.insert({ name: "Alice" });
    const first = await posts.insert({ title: "First", authorId: author.id });
    const second = await posts.insert({ title: "Second", authorId: author.id });

    authorId = author.id;
    postIds = [first.id, second.id];
  });

  afterAll(async () => {
    await source.disconnect();
    await rm(filename, { force: true });
  });

  beforeEach(() => {
    foreignQueries = [];
  });

  test("loads every relationId, and queries for it, when there is no projection", async () => {
    const [author] = await source.repository(RiProjAuthor).find();

    expect(author.postIds).toEqual(postIds);
    expect(foreignQueries).toHaveLength(1);
  });

  test("issues no query for a relationId the projection did not name", async () => {
    const [author] = await source
      .repository(RiProjAuthor)
      .find(undefined, { select: ["id", "name"] });

    expect(foreignQueries).toEqual([]);
    expect(author.name).toBe("Alice");
    expect(author.postIds).toBeUndefined();
  });

  test("loads a relationId the projection named", async () => {
    const [author] = await source
      .repository(RiProjAuthor)
      .find(undefined, { select: ["id", "postIds"] });

    expect(author.postIds).toEqual(postIds);
    expect(foreignQueries).toHaveLength(1);
  });

  test("accepts a @RelationId that is not a declared field in findOne", async () => {
    const author = await source
      .repository(RiProjAuthor)
      .findOne({ id: authorId }, { select: ["id", "postIds"] });

    expect(author?.postIds).toEqual(postIds);
  });

  test("rejects an unknown select key", async () => {
    await expect(
      source.repository(RiProjAuthor).find(undefined, { select: ["naem" as "name"] }),
    ).rejects.toThrow('Unknown field "naem" on "RiProjAuthor"');
  });

  test("rejects a relation named in select", async () => {
    await expect(
      source.repository(RiProjAuthor).find(undefined, { select: ["posts"] }),
    ).rejects.toThrow('Relation "posts" cannot be selected on "RiProjAuthor"');
  });
});
