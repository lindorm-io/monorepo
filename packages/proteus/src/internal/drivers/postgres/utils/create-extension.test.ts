import type { ILogger } from "@lindorm/logger";
import { describe, expect, it, vi } from "vitest";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import {
  createExtensionLocked,
  EXTENSION_LOCK_KEY_1,
  EXTENSION_LOCK_KEY_2,
} from "./create-extension.js";

type Recorded = { sql: string; params?: Array<unknown> };

const SQL = 'CREATE EXTENSION IF NOT EXISTS "pg_trgm";';

const options = (overrides: Record<string, unknown> = {}) => ({
  description: 'Create extension "pg_trgm"',
  extension: "pg_trgm" as string | undefined,
  lockTimeoutMs: 0,
  sql: SQL,
  ...overrides,
});

const pgError = (code: string, message: string): Error => {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
};

/**
 * `onQuery` may throw to simulate a failing statement, or return rows for the
 * `pg_extension` lookup. Everything else resolves empty.
 */
const makeClient = (
  onQuery: (sql: string) => Array<Record<string, unknown>> | void = () => undefined,
): { client: PostgresQueryClient; recorded: Array<Recorded> } => {
  const recorded: Array<Recorded> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: Array<unknown>) => {
      recorded.push({ sql, params });
      const rows = onQuery(sql) ?? [];
      return { rows, rowCount: rows.length };
    }),
  } as unknown as PostgresQueryClient;
  return { client, recorded };
};

const makeLogger = (): ILogger =>
  ({
    debug: vi.fn(),
    verbose: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    silly: vi.fn(),
    child: vi.fn(),
  }) as unknown as ILogger;

describe("createExtensionLocked — lock keys", () => {
  it("should use a key1 outside the namespace lock space", () => {
    // 0x50524f54 ("PROT") is key1 for every namespace-scoped proteus lock, so a
    // different key1 puts the extension lock in a space no namespace can reach.
    expect({ key1: EXTENSION_LOCK_KEY_1, key2: EXTENSION_LOCK_KEY_2 }).toMatchSnapshot();
    expect(EXTENSION_LOCK_KEY_1).not.toBe(0x50524f54);
  });
});

describe("createExtensionLocked — success", () => {
  it("should create the extension in its own transaction under the xact lock", async () => {
    const { client, recorded } = makeClient();
    const outcome = await createExtensionLocked(client, options());
    expect(outcome).toEqual({ status: "created" });
    expect(recorded).toMatchSnapshot();
  });

  it("should take the database-wide key pair", async () => {
    const { client, recorded } = makeClient();
    await createExtensionLocked(client, options());
    const lock = recorded.find((r) => r.sql.includes("pg_advisory_xact_lock"));
    expect(lock!.params).toEqual([EXTENSION_LOCK_KEY_1, EXTENSION_LOCK_KEY_2]);
  });

  it("should not set lock_timeout when the timeout is 0", async () => {
    const { client, recorded } = makeClient();
    await createExtensionLocked(client, options({ lockTimeoutMs: 0 }));
    expect(recorded.filter((r) => r.sql.includes("lock_timeout"))).toEqual([]);
  });

  it("should set a transaction-local lock_timeout when one is given", async () => {
    const { client, recorded } = makeClient();
    await createExtensionLocked(client, options({ lockTimeoutMs: 2500 }));
    expect(recorded.map((r) => r.sql)).toContain("SET LOCAL lock_timeout = '2500ms'");
  });

  it("should log the statement at debug", async () => {
    const logger = makeLogger();
    const { client } = makeClient();
    await createExtensionLocked(client, options({ logger }));
    expect(logger.debug).toHaveBeenCalledWith('Create extension "pg_trgm"', { sql: SQL });
  });

  it("should not require a logger", async () => {
    const { client } = makeClient();
    await expect(createExtensionLocked(client, options())).resolves.toEqual({
      status: "created",
    });
  });
});

describe("createExtensionLocked — lock timeout", () => {
  it("should report lock_timeout and roll back", async () => {
    const { client, recorded } = makeClient((sql) => {
      if (sql.includes("pg_advisory_xact_lock")) {
        throw pgError("55P03", "canceling statement due to lock timeout");
      }
    });

    const outcome = await createExtensionLocked(client, options({ lockTimeoutMs: 500 }));

    expect(outcome.status).toBe("lock_timeout");
    expect(recorded.map((r) => r.sql)).toContain("ROLLBACK");
  });

  it("should carry the underlying pg error", async () => {
    const error = pgError("55P03", "canceling statement due to lock timeout");
    const { client } = makeClient((sql) => {
      if (sql.includes("pg_advisory_xact_lock")) throw error;
    });

    const outcome = await createExtensionLocked(client, options({ lockTimeoutMs: 500 }));

    expect(outcome).toEqual({ status: "lock_timeout", error });
  });
});

describe("createExtensionLocked — duplicate object", () => {
  const duplicate = () =>
    pgError("23505", 'duplicate key value violates unique constraint "pg_extension_..."');

  it("should report already_present when the extension exists afterwards", async () => {
    const { client } = makeClient((sql) => {
      if (sql.startsWith("CREATE EXTENSION")) throw duplicate();
      if (sql.includes("pg_extension")) return [{ "?column?": 1 }];
    });

    await expect(createExtensionLocked(client, options())).resolves.toEqual({
      status: "already_present",
    });
  });

  it("should roll back before reporting already_present", async () => {
    const { client, recorded } = makeClient((sql) => {
      if (sql.startsWith("CREATE EXTENSION")) throw duplicate();
      if (sql.includes("pg_extension")) return [{ "?column?": 1 }];
    });

    await createExtensionLocked(client, options());

    expect(recorded.map((r) => r.sql)).toContain("ROLLBACK");
  });

  it("should report failed when the extension is absent afterwards", async () => {
    const { client } = makeClient((sql) => {
      if (sql.startsWith("CREATE EXTENSION")) throw duplicate();
    });

    const outcome = await createExtensionLocked(client, options());

    expect(outcome.status).toBe("failed");
  });

  it("should fail closed when the existence lookup itself errors", async () => {
    const { client } = makeClient((sql) => {
      if (sql.startsWith("CREATE EXTENSION")) throw duplicate();
      if (sql.includes("pg_extension")) throw new Error("catalog unavailable");
    });

    const outcome = await createExtensionLocked(client, options());

    expect(outcome.status).toBe("failed");
  });

  it("should not look up an unnamed extension", async () => {
    const { client, recorded } = makeClient((sql) => {
      if (sql.startsWith("CREATE EXTENSION")) throw duplicate();
      if (sql.includes("pg_extension")) return [{ "?column?": 1 }];
    });

    const outcome = await createExtensionLocked(
      client,
      options({ extension: undefined }),
    );

    // Without a name there is nothing to confirm, so the duplicate stays fatal
    expect(outcome.status).toBe("failed");
    expect(recorded.filter((r) => r.sql.includes("pg_extension"))).toEqual([]);
  });
});

describe("createExtensionLocked — failure", () => {
  it("should report failed for an unrelated error", async () => {
    const error = pgError("42501", "permission denied to create extension");
    const { client } = makeClient((sql) => {
      if (sql.startsWith("CREATE EXTENSION")) throw error;
    });

    await expect(createExtensionLocked(client, options())).resolves.toEqual({
      status: "failed",
      error,
    });
  });

  it("should preserve the original error when ROLLBACK also fails", async () => {
    const error = pgError("42501", "permission denied to create extension");
    const { client } = makeClient((sql) => {
      if (sql.startsWith("CREATE EXTENSION")) throw error;
      if (sql === "ROLLBACK") throw new Error("connection lost");
    });

    await expect(createExtensionLocked(client, options())).resolves.toEqual({
      status: "failed",
      error,
    });
  });
});
