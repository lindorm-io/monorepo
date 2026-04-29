import { randomBytes } from "crypto";
import { Client } from "pg";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { introspectSchema } from "./introspect-schema.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let client: PostgresQueryClient;
let raw: Client;
let schema: string;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_${randomBytes(6).toString("hex")}`;

  await raw.query(`CREATE SCHEMA ${schema}`);

  await raw.query(`
    CREATE TYPE ${schema}.enum_status AS ENUM ('active', 'inactive', 'banned')
  `);

  await raw.query(`
    CREATE TABLE ${schema}.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      status ${schema}.enum_status NOT NULL DEFAULT 'active',
      score INTEGER DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
    )
  `);

  await raw.query(`
    CREATE TABLE ${schema}.posts (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      author_id UUID NOT NULL REFERENCES ${schema}.users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
    )
  `);

  await raw.query(`
    CREATE TABLE ${schema}.tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL
    )
  `);

  await raw.query(`
    CREATE TABLE ${schema}.post_tags (
      post_id BIGINT NOT NULL REFERENCES ${schema}.posts(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES ${schema}.tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    )
  `);

  await raw.query(`
    ALTER TABLE ${schema}.users
      ADD CONSTRAINT uq_users_email UNIQUE (email)
  `);

  await raw.query(`
    ALTER TABLE ${schema}.users
      ADD CONSTRAINT chk_users_score CHECK (score >= 0)
  `);

  await raw.query(`
    CREATE INDEX idx_users_name ON ${schema}.users (name)
  `);

  await raw.query(`
    CREATE INDEX idx_posts_created ON ${schema}.posts (created_at DESC)
  `);

  await raw.query(`
    CREATE INDEX idx_users_active ON ${schema}.users (email) WHERE status = 'active'
  `);

  await raw.query(`
    COMMENT ON TABLE ${schema}.users IS 'User accounts'
  `);

  await raw.query(`
    COMMENT ON COLUMN ${schema}.users.email IS 'Primary email address'
  `);
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA ${schema} CASCADE`);
  await raw.end();
});

describe("introspectSchema (integration)", () => {
  it("should introspect full schema snapshot", async () => {
    const snapshot = await introspectSchema(client, [
      { schema, name: "users" },
      { schema, name: "posts" },
      { schema, name: "tags" },
      { schema, name: "post_tags" },
    ]);

    expect(snapshot.schemas).toContain(schema);

    // Tables
    expect(snapshot.tables).toHaveLength(4);
    const tableNames = snapshot.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual(["post_tags", "posts", "tags", "users"]);
  });

  it("should introspect users table columns", async () => {
    const snapshot = await introspectSchema(client, [{ schema, name: "users" }]);
    const users = snapshot.tables[0];

    expect(users.columns.map((c) => c.name)).toEqual([
      "id",
      "name",
      "email",
      "status",
      "score",
      "version",
      "created_at",
      "updated_at",
    ]);

    const id = users.columns.find((c) => c.name === "id")!;
    expect(id.type).toBe("uuid");
    expect(id.nullable).toBe(false);
    expect(id.defaultExpr).toBe("gen_random_uuid()");

    const name = users.columns.find((c) => c.name === "name")!;
    expect(name.type).toBe("text");
    expect(name.nullable).toBe(false);

    const score = users.columns.find((c) => c.name === "score")!;
    expect(score.type).toBe("integer");
    expect(score.nullable).toBe(true);
    expect(score.defaultExpr).toBe("0");

    const createdAt = users.columns.find((c) => c.name === "created_at")!;
    expect(createdAt.type).toBe("timestamp(3) with time zone");
  });

  it("should introspect identity columns", async () => {
    const snapshot = await introspectSchema(client, [{ schema, name: "posts" }]);
    const posts = snapshot.tables[0];

    const id = posts.columns.find((c) => c.name === "id")!;
    expect(id.type).toBe("bigint");
    expect(id.isIdentity).toBe(true);
    expect(id.identityGeneration).toBe("ALWAYS");
    expect(id.defaultExpr).toBeNull();
  });

  it("should introspect constraints", async () => {
    const snapshot = await introspectSchema(client, [
      { schema, name: "users" },
      { schema, name: "posts" },
    ]);

    const users = snapshot.tables.find((t) => t.name === "users")!;
    const posts = snapshot.tables.find((t) => t.name === "posts")!;

    // Users: PK, UNIQUE, CHECK
    const pk = users.constraints.find((c) => c.type === "PRIMARY KEY");
    expect(pk).toBeDefined();
    expect(pk!.columns).toEqual(["id"]);

    const uq = users.constraints.find((c) => c.type === "UNIQUE");
    expect(uq).toBeDefined();
    expect(uq!.name).toBe("uq_users_email");
    expect(uq!.columns).toEqual(["email"]);

    const chk = users.constraints.find((c) => c.type === "CHECK");
    expect(chk).toBeDefined();
    expect(chk!.name).toBe("chk_users_score");

    // Posts: FK
    const fk = posts.constraints.find((c) => c.type === "FOREIGN KEY");
    expect(fk).toBeDefined();
    expect(fk!.columns).toEqual(["author_id"]);
    expect(fk!.foreignTable).toBe("users");
    expect(fk!.foreignColumns).toEqual(["id"]);
    expect(fk!.onDelete).toBe("CASCADE");
    expect(fk!.onUpdate).toBe("NO ACTION");
  });

  it("should introspect indexes", async () => {
    const snapshot = await introspectSchema(client, [
      { schema, name: "users" },
      { schema, name: "posts" },
    ]);

    const users = snapshot.tables.find((t) => t.name === "users")!;
    const posts = snapshot.tables.find((t) => t.name === "posts")!;

    // users: idx_users_name (asc), idx_users_active (partial)
    const nameIdx = users.indexes.find((i) => i.name === "idx_users_name");
    expect(nameIdx).toBeDefined();
    expect(nameIdx!.columns).toEqual([{ name: "name", direction: "asc" }]);
    expect(nameIdx!.method).toBe("btree");

    const activeIdx = users.indexes.find((i) => i.name === "idx_users_active");
    expect(activeIdx).toBeDefined();
    expect(activeIdx!.where).toBeTruthy();

    // posts: idx_posts_created (desc)
    const createdIdx = posts.indexes.find((i) => i.name === "idx_posts_created");
    expect(createdIdx).toBeDefined();
    expect(createdIdx!.columns[0].direction).toBe("desc");
  });

  it("should introspect enums", async () => {
    const snapshot = await introspectSchema(client, [{ schema, name: "users" }]);

    expect(snapshot.enums).toHaveLength(1);
    expect(snapshot.enums[0].name).toBe("enum_status");
    expect(snapshot.enums[0].schema).toBe(schema);
    expect(snapshot.enums[0].values).toEqual(["active", "inactive", "banned"]);
  });

  it("should introspect comments", async () => {
    const snapshot = await introspectSchema(client, [{ schema, name: "users" }]);
    const users = snapshot.tables[0];

    expect(users.comment).toBe("User accounts");
    expect(users.columnComments.email).toBe("Primary email address");
  });

  it("should introspect composite primary key", async () => {
    const snapshot = await introspectSchema(client, [{ schema, name: "post_tags" }]);
    const postTags = snapshot.tables[0];

    const pk = postTags.constraints.find((c) => c.type === "PRIMARY KEY");
    expect(pk).toBeDefined();
    expect(pk!.columns.sort()).toEqual(["post_id", "tag_id"]);
  });
});
