import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { IPostgresSource } from "../interfaces";
import { PostgresSource } from "./PostgresSource";

describe("PostgresSource", () => {
  let source: IPostgresSource;
  let table: string;

  beforeAll(() => {
    source = new PostgresSource({
      logger: createMockLogger(),
      url: "postgres://root:example@localhost:5432/default",
    });
    table = "t_" + randomUUID().split("-").join("").substring(0, 8);
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should create a table", async () => {
    const create = `
      CREATE TABLE IF NOT EXISTS ${table} (
        id UUID PRIMARY KEY,
        username VARCHAR ( 128 ) NOT NULL,
        number INT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );
    `;

    const select = `
      SELECT * FROM information_schema.tables;
    `;

    await expect(source.query(create)).resolves.toBeTruthy();

    await expect(source.query(select)).resolves.toEqual(
      expect.objectContaining({
        rows: expect.arrayContaining([
          {
            table_catalog: "default",
            table_schema: "public",
            table_name: table,
            table_type: "BASE TABLE",
            self_referencing_column_name: null,
            reference_generation: null,
            user_defined_type_catalog: null,
            user_defined_type_schema: null,
            user_defined_type_name: null,
            is_insertable_into: "YES",
            is_typed: "NO",
            commit_action: null,
          },
        ]),
      }),
    );
  });

  test("should create a unique index", async () => {
    const create = `
      CREATE UNIQUE INDEX ${table}_username_number
        ON ${table} (username, number);
    `;

    const select = `
      SELECT
        indexname,
        indexdef
      FROM
        pg_indexes
      WHERE
        tablename = '${table}';
    `;

    await expect(source.query(create)).resolves.toBeTruthy();
    await expect(source.query(select)).resolves.toEqual(
      expect.objectContaining({
        rows: [
          {
            indexdef: `CREATE UNIQUE INDEX ${table}_pkey ON public.${table} USING btree (id)`,
            indexname: `${table}_pkey`,
          },
          {
            indexdef: `CREATE UNIQUE INDEX ${table}_username_number ON public.${table} USING btree (username, number)`,
            indexname: `${table}_username_number`,
          },
        ],
      }),
    );
  });

  test("should insert a row", async () => {
    const insert = `
      INSERT INTO ${table} (id, username, number, data)
        VALUES ($1, $2, $3, $4) RETURNING *;
    `;

    const values = [
      "8666cda3-114d-4c16-8c99-ef868e5f477b",
      "username",
      1234,
      { hello_there: "general kenobi" },
    ];

    await expect(source.query(insert, values)).resolves.toEqual(
      expect.objectContaining({
        rowCount: 1,
        rows: [
          {
            id: "8666cda3-114d-4c16-8c99-ef868e5f477b",
            username: "username",
            number: 1234,
            data: {
              hello_there: "general kenobi",
            },
            created_at: expect.any(Date),
          },
        ],
      }),
    );
  });

  test("should select a row", async () => {
    const select = `
      SELECT * FROM ${table}
        WHERE id = $1;
    `;

    const values = ["8666cda3-114d-4c16-8c99-ef868e5f477b"];

    await expect(source.query(select, values)).resolves.toEqual(
      expect.objectContaining({
        rowCount: 1,
        rows: [
          {
            id: "8666cda3-114d-4c16-8c99-ef868e5f477b",
            username: "username",
            number: 1234,
            data: {
              hello_there: "general kenobi",
            },
            created_at: expect.any(Date),
          },
        ],
      }),
    );
  });

  test("should throw on primary key", async () => {
    const insert = `
      INSERT INTO ${table} (id, username, number, data)
        VALUES ($1, $2, $3, $4) RETURNING *;
    `;

    const values = [
      "8666cda3-114d-4c16-8c99-ef868e5f477b",
      "username",
      5678,
      { throws: "error" },
    ];

    await expect(source.query(insert, values)).rejects.toThrow();
  });

  test("should throw on unique index", async () => {
    const insert = `
      INSERT INTO ${table} (id, username, number, data)
        VALUES ($1, $2, $3, $4) RETURNING *;
    `;

    const values = [
      "59ac0e31-ea96-4508-97a8-d3281c9a8883",
      "username",
      1234,
      { throws: "error" },
    ];

    await expect(source.query(insert, values)).rejects.toThrow();
  });
});
