import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger";
import { Client } from "pg";
import {
  TestUser,
  TestPost,
  TestSoftDelete,
  TestChecked,
  TestIndexed,
  TestUserWithProfile,
  TestProfile,
  TestAuthor,
  TestArticle,
  TestStudent,
  TestCourse,
  TestVersionKeyed,
} from "../../../__fixtures__/test-entities";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { projectDesiredSchema } from "../utils/sync/project-desired-schema";
import { introspectSchema } from "../utils/sync/introspect-schema";
import { diffSchema } from "../utils/sync/diff-schema";
import type { PostgresQueryClient } from "../types/postgres-query-client";
import { PostgresDriver } from "./PostgresDriver";

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";
const schema = `test_drv_${randomBytes(6).toString("hex")}`;

describe("PostgresDriver (integration)", () => {
  let raw: Client;

  beforeAll(async () => {
    raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    await raw.query(`CREATE SCHEMA "${schema}"`);
  });

  afterAll(async () => {
    await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await raw.end();
  });

  beforeEach(async () => {
    await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await raw.query(`CREATE SCHEMA "${schema}"`);
  });

  test("should create tables for all entities when synchronize is true", async () => {
    const entities = [
      TestUser,
      TestPost,
      TestSoftDelete,
      TestChecked,
      TestIndexed,
      TestUserWithProfile,
      TestProfile,
      TestAuthor,
      TestArticle,
      TestStudent,
      TestCourse,
      TestVersionKeyed,
    ];

    const driver = new PostgresDriver(
      {
        driver: "postgres",
        url: PG_CONNECTION,
        synchronize: true,
        logger: createMockLogger(),
      },
      createMockLogger(),
      schema,
      getEntityMetadata,
    );

    await driver.connect();

    try {
      await driver.setup(entities);

      const result = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [schema],
      );

      const tables = result.rows.map((r: any) => r.table_name);

      expect(tables).toMatchSnapshot();
    } finally {
      await driver.disconnect();
    }
  });

  test("should be idempotent — second sync produces no errors", async () => {
    const entities = [TestUser, TestChecked];

    const driver = new PostgresDriver(
      {
        driver: "postgres",
        url: PG_CONNECTION,
        synchronize: true,
        logger: createMockLogger(),
      },
      createMockLogger(),
      schema,
      getEntityMetadata,
    );

    await driver.connect();

    try {
      await driver.setup(entities);
      await driver.setup(entities);

      const result = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [schema],
      );

      const tables = result.rows.map((r: any) => r.table_name);

      expect(tables).toMatchSnapshot();
    } finally {
      await driver.disconnect();
    }
  });

  test("should skip sync when synchronize is not set", async () => {
    const driver = new PostgresDriver(
      {
        driver: "postgres",
        url: PG_CONNECTION,
        logger: createMockLogger(),
      },
      createMockLogger(),
      schema,
      getEntityMetadata,
    );

    await driver.connect();

    try {
      await driver.setup([TestUser]);

      const result = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
        [schema],
      );

      expect(result.rows).toHaveLength(0);
    } finally {
      await driver.disconnect();
    }
  });

  test("should dry-run without creating tables", async () => {
    const driver = new PostgresDriver(
      {
        driver: "postgres",
        url: PG_CONNECTION,
        synchronize: "dry-run",
        logger: createMockLogger(),
      },
      createMockLogger(),
      schema,
      getEntityMetadata,
    );

    await driver.connect();

    try {
      await driver.setup([TestUser]);

      const result = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
        [schema],
      );

      expect(result.rows).toHaveLength(0);
    } finally {
      await driver.disconnect();
    }
  });

  test("should create FK constraints between related entities", async () => {
    const entities = [TestAuthor, TestArticle];

    const driver = new PostgresDriver(
      {
        driver: "postgres",
        url: PG_CONNECTION,
        synchronize: true,
        logger: createMockLogger(),
      },
      createMockLogger(),
      schema,
      getEntityMetadata,
    );

    await driver.connect();

    try {
      await driver.setup(entities);

      const fkResult = await raw.query(
        `SELECT conname, contype
         FROM pg_constraint
         JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
         JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
         WHERE pg_namespace.nspname = $1
           AND contype = 'f'
         ORDER BY conname`,
        [schema],
      );

      expect(fkResult.rows.length).toBeGreaterThan(0);
      expect(fkResult.rows.map((r: any) => r.conname)).toMatchSnapshot();
    } finally {
      await driver.disconnect();
    }
  });

  test("should create join table for ManyToMany relations", async () => {
    const entities = [TestStudent, TestCourse];

    const driver = new PostgresDriver(
      {
        driver: "postgres",
        url: PG_CONNECTION,
        synchronize: true,
        logger: createMockLogger(),
      },
      createMockLogger(),
      schema,
      getEntityMetadata,
    );

    await driver.connect();

    try {
      await driver.setup(entities);

      const result = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [schema],
      );

      const tables = result.rows.map((r: any) => r.table_name);

      expect(tables).toMatchSnapshot();
    } finally {
      await driver.disconnect();
    }
  });

  test("should produce zero diff operations on second sync (round-trip parity)", async () => {
    const entities = [
      TestUser,
      TestPost,
      TestSoftDelete,
      TestChecked,
      TestIndexed,
      TestUserWithProfile,
      TestProfile,
      TestAuthor,
      TestArticle,
      TestStudent,
      TestCourse,
      TestVersionKeyed,
    ];

    const driver = new PostgresDriver(
      {
        driver: "postgres",
        url: PG_CONNECTION,
        synchronize: true,
        logger: createMockLogger(),
      },
      createMockLogger(),
      schema,
      getEntityMetadata,
    );

    await driver.connect();

    try {
      // First sync — creates everything
      await driver.setup(entities);

      // Now run the pipeline manually to verify zero drift
      const nsOptions = { namespace: schema };
      const metadatas = entities.map((e) => getEntityMetadata(e));
      const desired = projectDesiredSchema(metadatas, nsOptions);
      const managedTables = desired.tables.map((t) => ({
        schema: t.schema,
        name: t.name,
      }));

      const client: PostgresQueryClient = {
        query: async <R = Record<string, unknown>>(
          sql: string,
          params?: Array<unknown>,
        ) => {
          const result = await raw.query(sql, params);
          return { rows: result.rows as Array<R>, rowCount: result.rowCount ?? 0 };
        },
      };

      const snapshot = await introspectSchema(client, managedTables);
      const plan = diffSchema(snapshot, desired);

      // Zero operations = perfect round-trip parity
      const spurious = plan.operations.map((op) => `[${op.type}] ${op.description}`);
      expect(spurious).toEqual([]);
    } finally {
      await driver.disconnect();
    }
  });
});
