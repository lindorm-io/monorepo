/**
 * A projection decides which `@RelationCount` properties are loaded, and which
 * surface may name one at all.
 *
 * A relation count is not in the row: every count costs a batched
 * `COUNT(*) … GROUP BY` against the foreign table, issued after the rows are
 * read and only by a repository. Asserting the property alone would pass on an
 * implementation that still ran the query and threw the answer away, so the
 * queries themselves are counted off the live client.
 *
 * Both shapes are covered, because they fail differently: the documented one
 * carries a backing `@Field` — a column nothing maintains — while a bare one
 * has no column at all.
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
  RelationCount,
} from "../../../../decorators/index.js";
import type { SqliteQueryClient, SqliteRow } from "../types/sqlite-query-client.js";

@Entity({ name: "RcProjAuthor" })
class RcProjAuthor {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => RcProjPost, "author")
  posts!: Array<RcProjPost>;

  @RelationCount<RcProjAuthor>("posts")
  @Field("integer")
  postCount!: number;

  @RelationCount<RcProjAuthor>("posts")
  barePostCount!: number;
}

@Entity({ name: "RcProjPost" })
class RcProjPost {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  title!: string;

  @Field("uuid")
  authorId!: string;

  @JoinKey({ authorId: "id" })
  @ManyToOne(() => RcProjAuthor, "posts")
  author!: RcProjAuthor | null;
}

describe("SqliteRepository @RelationCount projection", () => {
  const filename = join(tmpdir(), `proteus-rcproj-${randomUUID()}.db`);

  let source: ProteusSource;
  let countQueries: Array<string>;
  let authorId: string;

  beforeAll(async () => {
    source = new ProteusSource({
      driver: "sqlite",
      filename,
      entities: [RcProjAuthor, RcProjPost],
      logger: createMockLogger(),
      synchronize: true,
    });

    await source.connect();
    await source.setup();

    // Count every COUNT(*) against the foreign table, whoever issues it.
    const client = await source.client<SqliteQueryClient>();
    const all = client.all.bind(client);
    client.all = (sql: string, params?: ReadonlyArray<unknown>): Array<SqliteRow> => {
      if (sql.includes("COUNT(*)") && sql.includes(`FROM "RcProjPost"`)) {
        countQueries.push(sql);
      }
      return all(sql, params);
    };

    const authors = source.repository(RcProjAuthor);
    const posts = source.repository(RcProjPost);

    const author = await authors.insert({ name: "Alice" });
    await posts.insert({ title: "First", authorId: author.id });
    await posts.insert({ title: "Second", authorId: author.id });

    authorId = author.id;
  });

  afterAll(async () => {
    await source.disconnect();
    await rm(filename, { force: true });
  });

  beforeEach(() => {
    countQueries = [];
  });

  test("loads every relation count, and queries for each, when there is no projection", async () => {
    const [author] = await source.repository(RcProjAuthor).find();

    expect(author.postCount).toBe(2);
    expect(author.barePostCount).toBe(2);
    expect(countQueries).toHaveLength(2);
  });

  test("issues no query for a relation count the projection did not name", async () => {
    const [author] = await source
      .repository(RcProjAuthor)
      .find(undefined, { select: ["id", "name"] });

    expect(countQueries).toEqual([]);
    expect(author.name).toBe("Alice");
    // A backing column left out of the projection hydrates as null; a property
    // with no column of its own is simply absent. Neither is the count.
    expect(author.postCount).toBeNull();
    expect(author.barePostCount).toBeUndefined();
  });

  test("loads the relation count the projection named, and only that one", async () => {
    const [author] = await source
      .repository(RcProjAuthor)
      .find(undefined, { select: ["id", "postCount"] });

    expect(author.postCount).toBe(2);
    expect(author.barePostCount).toBeUndefined();
    expect(countQueries).toHaveLength(1);
  });

  // The regression this closes: a count with no backing @Field was not in the
  // selectable set at all, so naming it threw — while an unprojected find
  // populated it happily.
  test("accepts a @RelationCount that is not a declared field", async () => {
    const author = await source
      .repository(RcProjAuthor)
      .findOne({ id: authorId }, { select: ["id", "barePostCount"] });

    expect(author?.barePostCount).toBe(2);
    expect(countQueries).toHaveLength(1);
  });

  test("the query builder refuses a relation count", async () => {
    expect(() => source.queryBuilder(RcProjAuthor).select("postCount")).toThrow(
      '@RelationCount "postCount" cannot be selected on "RcProjAuthor" here',
    );
  });

  test("a cursor refuses a relation count", async () => {
    await expect(
      source.repository(RcProjAuthor).cursor({ select: ["id", "postCount"] }),
    ).rejects.toThrow('@RelationCount "postCount" cannot be selected on "RcProjAuthor"');
  });

  test("a stream refuses a relation count at the first pull", async () => {
    const iterate = async (): Promise<void> => {
      for await (const _entity of source
        .repository(RcProjAuthor)
        .stream({ select: ["id", "postCount"] })) {
        break;
      }
    };

    await expect(iterate()).rejects.toThrow(
      '@RelationCount "postCount" cannot be selected on "RcProjAuthor"',
    );
  });
});
