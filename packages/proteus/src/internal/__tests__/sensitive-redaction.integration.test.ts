// End-to-end proof that @Sensitive redaction holds against REAL driver error
// shapes: a duplicate insert on a sensitive unique column must not leak the
// raw value anywhere in the thrown ProteusError (debug, details, errors, stack).

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  Entity,
  Field,
  Generated,
  PrimaryKeyField,
  Sensitive,
  Unique,
} from "../../decorators/index.js";
import { ProteusError } from "../../errors/ProteusError.js";
import { ProteusSource } from "../../classes/ProteusSource.js";

vi.setConfig({ testTimeout: 120_000 });

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";
const MYSQL_HOST = process.env["MYSQL_HOST"] ?? "127.0.0.1";
const MYSQL_PORT = Number(process.env["MYSQL_PORT"] ?? 3306);
const MYSQL_USER = "root";
const MYSQL_PASSWORD = "example";

const SECRET = "hunter2-super-secret-token";

@Entity({ name: "SensitiveToken" })
class SensitiveToken {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Unique({ name: "uq_sensitive_token_hash" })
  @Sensitive()
  @Field("string")
  tokenHash!: string;

  @Field("string")
  name!: string;
}

const expectRedacted = (error: ProteusError): void => {
  const serialized = JSON.stringify(error.toJSON());
  expect(serialized).not.toContain(SECRET);
  expect(error.debug.detail).toContain("[Filtered]");
};

describe("sensitive redaction against real drivers", () => {
  describe("postgres", () => {
    const namespace = `sens_pg_${randomBytes(6).toString("hex")}`;
    let source: ProteusSource;

    beforeAll(async () => {
      const raw = new Client({ connectionString: PG_CONNECTION });
      await raw.connect();
      await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
      await raw.query(`CREATE SCHEMA "${namespace}"`);
      await raw.end();

      source = new ProteusSource({
        driver: "postgres",
        url: PG_CONNECTION,
        namespace,
        naming: "snake",
        synchronize: true,
        entities: [SensitiveToken],
        logger: createMockLogger(),
      });
      await source.connect();
      await source.setup();
    });

    afterAll(async () => {
      if (source) await source.disconnect();
      const raw = new Client({ connectionString: PG_CONNECTION });
      await raw.connect();
      try {
        await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
      } finally {
        await raw.end();
      }
    });

    test("duplicate insert on a @Sensitive unique column leaks no raw value", async () => {
      const repo = source.repository(SensitiveToken);

      await repo.insert(repo.create({ tokenHash: SECRET, name: "first" }));

      let error: ProteusError | undefined;
      try {
        await repo.insert(repo.create({ tokenHash: SECRET, name: "second" }));
      } catch (caught) {
        error = caught as ProteusError;
      }

      expect(error).toBeInstanceOf(ProteusError);
      expectRedacted(error!);
    });
  });

  describe("mysql", () => {
    const database = `sens_my_${randomBytes(6).toString("hex")}`;
    let source: ProteusSource;

    beforeAll(async () => {
      const adminConn = await mysql.createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
      });
      await adminConn.execute(`CREATE DATABASE \`${database}\``);
      await adminConn.end();

      source = new ProteusSource({
        driver: "mysql",
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        database,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        naming: "snake",
        synchronize: true,
        entities: [SensitiveToken],
        logger: createMockLogger(),
      });
      await source.connect();
      await source.setup();
    });

    afterAll(async () => {
      if (source) await source.disconnect();
      const adminConn = await mysql.createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
      });
      try {
        await adminConn.execute(`DROP DATABASE IF EXISTS \`${database}\``);
      } finally {
        await adminConn.end();
      }
    });

    test("duplicate insert on a @Sensitive unique column leaks no raw value", async () => {
      const repo = source.repository(SensitiveToken);

      await repo.insert(repo.create({ tokenHash: SECRET, name: "first" }));

      let error: ProteusError | undefined;
      try {
        await repo.insert(repo.create({ tokenHash: SECRET, name: "second" }));
      } catch (caught) {
        error = caught as ProteusError;
      }

      expect(error).toBeInstanceOf(ProteusError);
      expectRedacted(error!);
    });
  });
});
