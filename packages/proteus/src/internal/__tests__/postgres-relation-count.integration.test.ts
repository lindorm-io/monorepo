// Regression for F11: a @RelationCount column is derived (recomputed on read)
// and skipped on write, so its backing @Field column must default to 0 —
// otherwise the NOT NULL column rejects an insert that does not carry the
// derived value.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  Entity,
  Field,
  Generated,
  ManyToOne,
  OneToMany,
  PrimaryKeyField,
  RelationCount,
} from "../../decorators/index.js";
import { ProteusSource } from "../../classes/ProteusSource.js";

vi.setConfig({ testTimeout: 120_000 });

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";
const namespace = `tck_relcount_${randomBytes(6).toString("hex")}`;

@Entity({ name: "RcBlog" })
class RcBlog {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  title!: string;

  @OneToMany(() => RcComment, "blog")
  comments!: RcComment[];

  @RelationCount<RcBlog>("comments")
  @Field("integer")
  commentCount!: number;
}

@Entity({ name: "RcComment" })
class RcComment {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  body!: string;

  @ManyToOne(() => RcBlog, "comments")
  blog!: RcBlog | null;

  blogId!: string | null;
}

let source: ProteusSource;

describe("postgres @RelationCount column default", () => {
  beforeAll(async () => {
    const logger = createMockLogger();

    const raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await raw.query(`CREATE SCHEMA "${namespace}"`);
    await raw.end();

    source = new ProteusSource({
      driver: "postgres",
      url: PG_CONNECTION,
      namespace,
      synchronize: true,
      entities: [RcBlog, RcComment],
      logger,
    });

    await source.connect();
    await source.setup();
  });

  afterAll(async () => {
    if (source) {
      await source.disconnect();
    }
    const raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    try {
      await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    } finally {
      await raw.end();
    }
  });

  test("insert without the derived count succeeds; count is recomputed on read", async () => {
    const blogs = source.repository(RcBlog);
    const comments = source.repository(RcComment);

    // Insert without specifying commentCount — must not violate NOT NULL.
    const blog = await blogs.insert({ title: "Hello" });
    expect(blog.id).toBeDefined();

    await comments.insert({ body: "first", blogId: blog.id });
    await comments.insert({ body: "second", blogId: blog.id });

    const found = await blogs.findOne({ id: blog.id });
    expect(found!.commentCount).toBe(2);
  });
});
