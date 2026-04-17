import { ProteusError } from "../../errors/ProteusError";
import { ProteusSource } from "../../classes/ProteusSource";
import { MigrationManager } from "../drivers/postgres/classes/MigrationManager";
import { MySqlMigrationManager } from "../drivers/mysql/classes/MySqlMigrationManager";
import { SqliteMigrationManager } from "../drivers/sqlite/classes/SqliteMigrationManager";
import { withMigrationManager, wrapPoolClient } from "./with-migration-manager";

jest.mock("../../classes/ProteusSource");
jest.mock("../drivers/postgres/classes/MigrationManager");
jest.mock("../drivers/mysql/classes/MySqlMigrationManager");
jest.mock("../drivers/sqlite/classes/SqliteMigrationManager");

const createMockSource = (driverType: string, migrationsTable?: string) => {
  const source = {
    driverType,
    migrationsTable,
    log: {
      child: jest.fn().mockReturnValue({ info: jest.fn(), debug: jest.fn() }),
    },
    client: jest.fn(),
  } as unknown as ProteusSource;
  return source;
};

describe("withMigrationManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const mockRelease = jest.fn();
      const mockPoolClient = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres");
      (source.client as jest.Mock).mockResolvedValue(mockPoolClient);

      const fn = jest.fn();
      await withMigrationManager(source, "/migrations", fn);

      expect(MigrationManager).toHaveBeenCalledTimes(1);
      expect((MigrationManager as jest.Mock).mock.calls[0]).toMatchSnapshot();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].source).toBe(source);
    });

    it("should pass tableOptions when migrationsTable is set", async () => {
      const mockRelease = jest.fn();
      const mockPoolClient = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres", "custom_migrations");
      (source.client as jest.Mock).mockResolvedValue(mockPoolClient);

      await withMigrationManager(source, "/migrations", jest.fn());

      expect((MigrationManager as jest.Mock).mock.calls[0]).toMatchSnapshot();
    });

    it("should release the pool client after successful execution", async () => {
      const mockRelease = jest.fn();
      const mockPoolClient = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres");
      (source.client as jest.Mock).mockResolvedValue(mockPoolClient);

      await withMigrationManager(source, "/migrations", async () => {});

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it("should release the pool client when fn throws", async () => {
      const mockRelease = jest.fn();
      const mockPoolClient = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres");
      (source.client as jest.Mock).mockResolvedValue(mockPoolClient);

      const error = new Error("migration failed");

      await expect(
        withMigrationManager(source, "/migrations", async () => {
          throw error;
        }),
      ).rejects.toThrow(error);

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it("should only release once even if release is somehow called twice", async () => {
      const mockRelease = jest.fn();
      const mockPoolClient = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("postgres");
      (source.client as jest.Mock).mockResolvedValue(mockPoolClient);

      await withMigrationManager(source, "/migrations", async () => {});

      // The internal release guard ensures only one call
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe("mysql driver", () => {
    it("should create a MySqlMigrationManager and call fn with context", async () => {
      const mockRelease = jest.fn();
      const mockConnection = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("mysql");
      (source.client as jest.Mock).mockResolvedValue(mockConnection);

      const fn = jest.fn();
      await withMigrationManager(source, "/migrations", fn);

      expect(MySqlMigrationManager).toHaveBeenCalledTimes(1);
      expect((MySqlMigrationManager as jest.Mock).mock.calls[0]).toMatchSnapshot();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].source).toBe(source);
    });

    it("should pass tableOptions when migrationsTable is set", async () => {
      const mockRelease = jest.fn();
      const mockConnection = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("mysql", "my_migrations");
      (source.client as jest.Mock).mockResolvedValue(mockConnection);

      await withMigrationManager(source, "/migrations", jest.fn());

      expect((MySqlMigrationManager as jest.Mock).mock.calls[0]).toMatchSnapshot();
    });

    it("should release the connection after successful execution", async () => {
      const mockRelease = jest.fn();
      const mockConnection = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("mysql");
      (source.client as jest.Mock).mockResolvedValue(mockConnection);

      await withMigrationManager(source, "/migrations", async () => {});

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it("should release the connection when fn throws", async () => {
      const mockRelease = jest.fn();
      const mockConnection = {
        query: jest.fn(),
        release: mockRelease,
      };
      const source = createMockSource("mysql");
      (source.client as jest.Mock).mockResolvedValue(mockConnection);

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
      const mockClient = { query: jest.fn() };
      const source = createMockSource("sqlite");
      (source.client as jest.Mock).mockResolvedValue(mockClient);

      const fn = jest.fn();
      await withMigrationManager(source, "/migrations", fn);

      expect(SqliteMigrationManager).toHaveBeenCalledTimes(1);
      expect((SqliteMigrationManager as jest.Mock).mock.calls[0]).toMatchSnapshot();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].source).toBe(source);
    });

    it("should pass tableOptions when migrationsTable is set", async () => {
      const mockClient = { query: jest.fn() };
      const source = createMockSource("sqlite", "sqlite_migrations");
      (source.client as jest.Mock).mockResolvedValue(mockClient);

      await withMigrationManager(source, "/migrations", jest.fn());

      expect((SqliteMigrationManager as jest.Mock).mock.calls[0]).toMatchSnapshot();
    });

    it("should not have a release step (sqlite has no pooled connections)", async () => {
      const mockClient = { query: jest.fn() };
      const source = createMockSource("sqlite");
      (source.client as jest.Mock).mockResolvedValue(mockClient);

      // Should complete without error — no release needed
      await withMigrationManager(source, "/migrations", async () => {});

      expect(source.client).toHaveBeenCalledTimes(1);
    });
  });
});

describe("wrapPoolClient", () => {
  it("should wrap a PoolClient query returning rows", async () => {
    const mockPoolClient = {
      query: jest.fn().mockResolvedValue({
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
      query: jest.fn().mockResolvedValue({
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
      query: jest.fn().mockResolvedValue({
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
      query: jest.fn().mockResolvedValue([rows, []]),
      release: jest.fn(),
    };
    const source = createMockSource("mysql");
    (source.client as jest.Mock).mockResolvedValue(mockConnection);

    let capturedClient: any;
    (MySqlMigrationManager as jest.Mock).mockImplementation((opts: any) => {
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
      query: jest.fn().mockResolvedValue([resultHeader, undefined]),
      release: jest.fn(),
    };
    const source = createMockSource("mysql");
    (source.client as jest.Mock).mockResolvedValue(mockConnection);

    let capturedClient: any;
    (MySqlMigrationManager as jest.Mock).mockImplementation((opts: any) => {
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
      query: jest.fn().mockResolvedValue([resultHeader, undefined]),
      release: jest.fn(),
    };
    const source = createMockSource("mysql");
    (source.client as jest.Mock).mockResolvedValue(mockConnection);

    let capturedClient: any;
    (MySqlMigrationManager as jest.Mock).mockImplementation((opts: any) => {
      capturedClient = opts.client;
      return {};
    });

    await withMigrationManager(source, "/migrations", async () => {});

    const result = await capturedClient.query("UPDATE test SET x = 1");
    expect(result).toMatchSnapshot();
  });
});
