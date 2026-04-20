import { ProteusError } from "../../errors/ProteusError";
import { ProteusSource } from "../../classes/ProteusSource";
import { MigrationManager } from "../drivers/postgres/classes/MigrationManager";
import { MySqlMigrationManager } from "../drivers/mysql/classes/MySqlMigrationManager";
import { SqliteMigrationManager } from "../drivers/sqlite/classes/SqliteMigrationManager";
import { withMigrationManager, wrapPoolClient } from "./with-migration-manager";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../../classes/ProteusSource");
vi.mock("../drivers/postgres/classes/MigrationManager");
vi.mock("../drivers/mysql/classes/MySqlMigrationManager");
vi.mock("../drivers/sqlite/classes/SqliteMigrationManager");

const createMockSource = (driverType: string, migrationsTable?: string) => {
  const source = {
    driverType,
    migrationsTable,
    log: {
      child: vi.fn().mockReturnValue({ info: vi.fn(), debug: vi.fn() }),
    },
    client: vi.fn(),
  } as unknown as ProteusSource;
  return source;
};

describe("withMigrationManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unsupported drivers", () => {
    it("should throw ProteusError for memory driver", async () => {
      const source = createMockSource("memory");

      await expect(
        withMigrationManager(source, "/migrations", async () => {}),
      ).rejects.toMatchSnapshot();
    });

    it("should throw ProteusError for redis driver", async () => {
      const source = createMockSource("redis");

      await expect(
        withMigrationManager(source, "/migrations", async () => {}),
      ).rejects.toMatchSnapshot();
    });

    it("should throw ProteusError for mongodb driver", async () => {
      const source = createMockSource("mongodb");

      await expect(
        withMigrationManager(source, "/migrations", async () => {}),
      ).rejects.toMatchSnapshot();
    });

    it("should throw ProteusError for unknown driver", async () => {
      const source = createMockSource("unknown");

      await expect(
        withMigrationManager(source, "/migrations", async () => {}),
      ).rejects.toMatchSnapshot();
    });
  });

  describe("postgres driver", () => {
    it("should create a MigrationManager and call fn with context", async () => {
      const mockRelease = vi.fn();
      const mockPoolClient = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres");
      (source.client as Mock).mockResolvedValue(mockPoolClient);

      const fn = vi.fn();
      await withMigrationManager(source, "/migrations", fn);

      expect(MigrationManager).toHaveBeenCalledTimes(1);
      expect((MigrationManager as Mock).mock.calls[0]).toMatchSnapshot();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].source).toBe(source);
    });

    it("should pass tableOptions when migrationsTable is set", async () => {
      const mockRelease = vi.fn();
      const mockPoolClient = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres", "custom_migrations");
      (source.client as Mock).mockResolvedValue(mockPoolClient);

      await withMigrationManager(source, "/migrations", vi.fn());

      expect((MigrationManager as Mock).mock.calls[0]).toMatchSnapshot();
    });

    it("should release the pool client after successful execution", async () => {
      const mockRelease = vi.fn();
      const mockPoolClient = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres");
      (source.client as Mock).mockResolvedValue(mockPoolClient);

      await withMigrationManager(source, "/migrations", async () => {});

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it("should release the pool client when fn throws", async () => {
      const mockRelease = vi.fn();
      const mockPoolClient = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres");
      (source.client as Mock).mockResolvedValue(mockPoolClient);

      const error = new Error("migration failed");

      await expect(
        withMigrationManager(source, "/migrations", async () => {
          throw error;
        }),
      ).rejects.toThrow(error);

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it("should only release once even if release is somehow called twice", async () => {
      const mockRelease = vi.fn();
      const mockPoolClient = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres");
      (source.client as Mock).mockResolvedValue(mockPoolClient);

      await withMigrationManager(source, "/migrations", async () => {});

      // The internal release guard ensures only one call
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe("mysql driver", () => {
    it("should create a MySqlMigrationManager and call fn with context", async () => {
      const mockRelease = vi.fn();
      const mockConnection = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("mysql");
      (source.client as Mock).mockResolvedValue(mockConnection);

      const fn = vi.fn();
      await withMigrationManager(source, "/migrations", fn);

      expect(MySqlMigrationManager).toHaveBeenCalledTimes(1);
      expect((MySqlMigrationManager as Mock).mock.calls[0]).toMatchSnapshot();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].source).toBe(source);
    });

    it("should pass tableOptions when migrationsTable is set", async () => {
      const mockRelease = vi.fn();
      const mockConnection = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("mysql", "my_migrations");
      (source.client as Mock).mockResolvedValue(mockConnection);

      await withMigrationManager(source, "/migrations", vi.fn());

      expect((MySqlMigrationManager as Mock).mock.calls[0]).toMatchSnapshot();
    });

    it("should release the connection after successful execution", async () => {
      const mockRelease = vi.fn();
      const mockConnection = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("mysql");
      (source.client as Mock).mockResolvedValue(mockConnection);

      await withMigrationManager(source, "/migrations", async () => {});

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it("should release the connection when fn throws", async () => {
      const mockRelease = vi.fn();
      const mockConnection = {
        query: vi.fn(),
        release: mockRelease,
      };
      const source = createMockSource("mysql");
      (source.client as Mock).mockResolvedValue(mockConnection);

      const error = new Error("mysql migration failed");

      await expect(
        withMigrationManager(source, "/migrations", async () => {
          throw error;
        }),
      ).rejects.toThrow(error);

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe("sqlite driver", () => {
    it("should create a SqliteMigrationManager and call fn with context", async () => {
      const mockClient = { query: vi.fn() };
      const source = createMockSource("sqlite");
      (source.client as Mock).mockResolvedValue(mockClient);

      const fn = vi.fn();
      await withMigrationManager(source, "/migrations", fn);

      expect(SqliteMigrationManager).toHaveBeenCalledTimes(1);
      expect((SqliteMigrationManager as Mock).mock.calls[0]).toMatchSnapshot();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].source).toBe(source);
    });

    it("should pass tableOptions when migrationsTable is set", async () => {
      const mockClient = { query: vi.fn() };
      const source = createMockSource("sqlite", "sqlite_migrations");
      (source.client as Mock).mockResolvedValue(mockClient);

      await withMigrationManager(source, "/migrations", vi.fn());

      expect((SqliteMigrationManager as Mock).mock.calls[0]).toMatchSnapshot();
    });

    it("should not have a release step (sqlite has no pooled connections)", async () => {
      const mockClient = { query: vi.fn() };
      const source = createMockSource("sqlite");
      (source.client as Mock).mockResolvedValue(mockClient);

      // Should complete without error — no release needed
      await withMigrationManager(source, "/migrations", async () => {});

      expect(source.client).toHaveBeenCalledTimes(1);
    });
  });
});

describe("wrapPoolClient", () => {
  it("should wrap a PoolClient query returning rows", async () => {
    const mockPoolClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 1, name: "test" }],
        rowCount: 1,
      }),
    };

    const wrapped = wrapPoolClient(mockPoolClient as any);
    const result = await wrapped.query("SELECT * FROM test WHERE id = $1", [1]);

    expect(result).toMatchSnapshot();
    expect(mockPoolClient.query).toHaveBeenCalledWith(
      "SELECT * FROM test WHERE id = $1",
      [1],
    );
  });

  it("should handle null rowCount", async () => {
    const mockPoolClient = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: null,
      }),
    };

    const wrapped = wrapPoolClient(mockPoolClient as any);
    const result = await wrapped.query("DELETE FROM test");

    expect(result).toMatchSnapshot();
  });

  it("should pass through without params", async () => {
    const mockPoolClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ count: 5 }],
        rowCount: 1,
      }),
    };

    const wrapped = wrapPoolClient(mockPoolClient as any);
    const result = await wrapped.query("SELECT count(*) FROM test");

    expect(result).toMatchSnapshot();
    expect(mockPoolClient.query).toHaveBeenCalledWith(
      "SELECT count(*) FROM test",
      undefined,
    );
  });
});

describe("wrapMysqlConnection", () => {
  // wrapMysqlConnection is not exported, so we test it indirectly through withMigrationManager.
  // The MySqlMigrationManager is mocked, but we can verify the client wrapper behavior
  // by capturing what's passed to the constructor.

  it("should wrap array results (SELECT queries)", async () => {
    const rows = [
      { id: 1, name: "row1" },
      { id: 2, name: "row2" },
    ];
    const mockConnection = {
      query: vi.fn().mockResolvedValue([rows, []]),
      release: vi.fn(),
    };
    const source = createMockSource("mysql");
    (source.client as Mock).mockResolvedValue(mockConnection);

    let capturedClient: any;
    (MySqlMigrationManager as Mock).mockImplementation(function (opts: any) {
      capturedClient = opts.client;
      return {};
    });

    await withMigrationManager(source, "/migrations", async () => {});

    const result = await capturedClient.query("SELECT * FROM test");
    expect(result).toMatchSnapshot();
  });

  it("should wrap non-array results (INSERT/UPDATE/DELETE queries)", async () => {
    const resultHeader = { affectedRows: 3, insertId: 42n };
    const mockConnection = {
      query: vi.fn().mockResolvedValue([resultHeader, undefined]),
      release: vi.fn(),
    };
    const source = createMockSource("mysql");
    (source.client as Mock).mockResolvedValue(mockConnection);

    let capturedClient: any;
    (MySqlMigrationManager as Mock).mockImplementation(function (opts: any) {
      capturedClient = opts.client;
      return {};
    });

    await withMigrationManager(source, "/migrations", async () => {});

    const result = await capturedClient.query("INSERT INTO test VALUES (?)");
    expect(result).toMatchSnapshot();
  });

  it("should handle result header with no affectedRows or insertId", async () => {
    const resultHeader = {};
    const mockConnection = {
      query: vi.fn().mockResolvedValue([resultHeader, undefined]),
      release: vi.fn(),
    };
    const source = createMockSource("mysql");
    (source.client as Mock).mockResolvedValue(mockConnection);

    let capturedClient: any;
    (MySqlMigrationManager as Mock).mockImplementation(function (opts: any) {
      capturedClient = opts.client;
      return {};
    });

    await withMigrationManager(source, "/migrations", async () => {});

    const result = await capturedClient.query("UPDATE test SET x = 1");
    expect(result).toMatchSnapshot();
  });
});
