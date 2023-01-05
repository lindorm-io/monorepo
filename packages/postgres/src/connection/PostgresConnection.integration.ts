import { PostgresConnection } from "./PostgresConnection";
import { createMockLogger } from "@lindorm-io/core-logger";

describe("PostgresConnection", () => {
  const logger = createMockLogger();

  let connection: PostgresConnection;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5010,
        user: "root",
        password: "example",
        database: "default",
      },
      logger,
    );

    await connection.connect();
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should create a table", async () => {
    const create = `
      CREATE TABLE IF NOT EXISTS users (
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

    await expect(connection.query(create)).resolves.toBeTruthy();

    await expect(connection.query(select)).resolves.toStrictEqual(
      expect.objectContaining({
        rows: expect.arrayContaining([
          {
            table_catalog: "default",
            table_schema: "public",
            table_name: "users",
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
      CREATE UNIQUE INDEX idx_username_number
        ON users (username, number);
    `;

    const select = `
      SELECT
        indexname,
        indexdef
      FROM
        pg_indexes
      WHERE
        tablename = 'users';
    `;

    await expect(connection.query(create)).resolves.toBeTruthy();
    await expect(connection.query(select)).resolves.toStrictEqual(
      expect.objectContaining({
        rows: [
          {
            indexdef: "CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)",
            indexname: "users_pkey",
          },
          {
            indexdef:
              "CREATE UNIQUE INDEX idx_username_number ON public.users USING btree (username, number)",
            indexname: "idx_username_number",
          },
        ],
      }),
    );
  });

  test("should insert a row", async () => {
    const insert = `
      INSERT INTO users (id, username, number, data)
        VALUES ($1, $2, $3, $4) RETURNING *;
    `;

    const values = [
      "8666cda3-114d-4c16-8c99-ef868e5f477b",
      "username",
      1234,
      { hello_there: "general kenobi" },
    ];

    await expect(connection.query(insert, values)).resolves.toStrictEqual(
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
      SELECT * FROM users
        WHERE id = $1;
    `;

    const values = ["8666cda3-114d-4c16-8c99-ef868e5f477b"];

    await expect(connection.query(select, values)).resolves.toStrictEqual(
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
      INSERT INTO users (id, username, number, data)
        VALUES ($1, $2, $3, $4) RETURNING *;
    `;

    const values = ["8666cda3-114d-4c16-8c99-ef868e5f477b", "username", 5678, { throws: "error" }];

    await expect(connection.query(insert, values)).rejects.toThrow();
  });

  test("should throw on unique index", async () => {
    const insert = `
      INSERT INTO users (id, username, number, data)
        VALUES ($1, $2, $3, $4) RETURNING *;
    `;

    const values = ["59ac0e31-ea96-4508-97a8-d3281c9a8883", "username", 1234, { throws: "error" }];

    await expect(connection.query(insert, values)).rejects.toThrow();
  });
});
