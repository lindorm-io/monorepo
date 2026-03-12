import type { ILogger } from "@lindorm/logger";
import { PostgresMigrationError } from "../errors/PostgresMigrationError";
import type { PostgresQueryClient } from "../types/postgres-query-client";
import type {
  LoadedMigration,
  MigrationInterface,
  MigrationRecord,
} from "../types/migration";
import { MigrationManager } from "./MigrationManager";

// Mock all migration utilities
jest.mock("../utils/advisory-lock", () => ({
  withAdvisoryLock: jest.fn(
    async (_client: unknown, _k1: unknown, _k2: unknown, fn: () => Promise<unknown>) =>
      fn(),
  ),
}));
jest.mock("../utils/migration/load-migrations", () => ({
  loadMigrations: jest.fn(),
}));
jest.mock("../utils/migration/migration-table", () => ({
  ensureMigrationTable: jest.fn(),
  getAppliedMigrations: jest.fn(),
  getPartiallyAppliedMigrations: jest.fn(),
  getAllMigrationRecords: jest.fn(),
  insertMigrationRecord: jest.fn(),
  markMigrationFinished: jest.fn(),
  markMigrationRolledBack: jest.fn(),
}));
jest.mock("../utils/migration/resolve-pending", () => ({
  resolvePending: jest.fn(),
}));
jest.mock("../utils/migration/execute-migration", () => ({
  executeMigrationUp: jest.fn(),
  executeMigrationDown: jest.fn(),
}));
jest.mock("@lindorm/sha", () => ({
  ShaKit: { S256: jest.fn(() => "hash-xxx") },
}));

import { withAdvisoryLock } from "../utils/advisory-lock";
import { loadMigrations } from "../utils/migration/load-migrations";
import {
  ensureMigrationTable,
  getAppliedMigrations,
  getPartiallyAppliedMigrations,
  getAllMigrationRecords,
} from "../utils/migration/migration-table";
import { resolvePending } from "../utils/migration/resolve-pending";
import {
  executeMigrationUp,
  executeMigrationDown,
} from "../utils/migration/execute-migration";

const mockAdvisoryLock = withAdvisoryLock as jest.MockedFunction<typeof withAdvisoryLock>;
const mockLoadMigrations = loadMigrations as jest.MockedFunction<typeof loadMigrations>;
const mockEnsureTable = ensureMigrationTable as jest.MockedFunction<
  typeof ensureMigrationTable
>;
const mockGetApplied = getAppliedMigrations as jest.MockedFunction<
  typeof getAppliedMigrations
>;
const mockGetPartiallyApplied = getPartiallyAppliedMigrations as jest.MockedFunction<
  typeof getPartiallyAppliedMigrations
>;
const mockGetAllRecords = getAllMigrationRecords as jest.MockedFunction<
  typeof getAllMigrationRecords
>;
const mockResolvePending = resolvePending as jest.MockedFunction<typeof resolvePending>;
const mockExecuteUp = executeMigrationUp as jest.MockedFunction<
  typeof executeMigrationUp
>;
const mockExecuteDown = executeMigrationDown as jest.MockedFunction<
  typeof executeMigrationDown
>;

const mockClient: PostgresQueryClient = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

const mockLogger: ILogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
  child: jest.fn().mockReturnThis(),
} as unknown as ILogger;

const makeMigration = (id: string): MigrationInterface => ({
  id,
  ts: "2026-02-20T09:00:00.000Z",
  up: jest.fn(),
  down: jest.fn(),
});

const makeLoaded = (name: string, id: string): LoadedMigration => ({
  migration: makeMigration(id),
  name,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAdvisoryLock.mockImplementation(async (_client, _k1, _k2, fn) => fn());
  mockLoadMigrations.mockResolvedValue([]);
  mockGetApplied.mockResolvedValue([]);
  mockGetPartiallyApplied.mockResolvedValue([]);
  mockGetAllRecords.mockResolvedValue([]);
  mockResolvePending.mockReturnValue({ resolved: [], ghosts: [] });
});

describe("MigrationManager", () => {
  describe("status", () => {
    it("should load migrations, resolve pending, and return status", async () => {
      const loaded = [makeLoaded("20260220090000-init", "aaa")];
      mockLoadMigrations.mockResolvedValue(loaded);
      mockResolvePending.mockReturnValue({
        resolved: [
          {
            migration: loaded[0].migration,
            name: "20260220090000-init",
            status: "pending" as const,
            appliedChecksum: null,
          },
        ],
        ghosts: [],
      });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const result = await manager.status();

      expect(mockLoadMigrations).toHaveBeenCalledWith("/migrations", mockLogger);
      expect(mockEnsureTable).toHaveBeenCalledWith(mockClient, undefined);
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].status).toBe("pending");
    });
  });

  describe("apply", () => {
    it("should apply pending migrations in order", async () => {
      const loaded = [
        makeLoaded("20260220090000-first", "aaa"),
        makeLoaded("20260221090000-second", "bbb"),
      ];
      mockLoadMigrations.mockResolvedValue(loaded);
      mockResolvePending.mockReturnValue({
        resolved: [
          {
            migration: loaded[0].migration,
            name: "20260220090000-first",
            status: "pending" as const,
            appliedChecksum: null,
          },
          {
            migration: loaded[1].migration,
            name: "20260221090000-second",
            status: "pending" as const,
            appliedChecksum: null,
          },
        ],
        ghosts: [],
      });
      mockExecuteUp.mockResolvedValue({ name: "test", durationMs: 10 });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const result = await manager.apply();

      expect(mockExecuteUp).toHaveBeenCalledTimes(2);
      expect(result.applied).toHaveLength(2);
      expect(result.skipped).toBe(0);
    });

    it("should skip already applied migrations", async () => {
      const loaded = [makeLoaded("20260220090000-init", "aaa")];
      mockLoadMigrations.mockResolvedValue(loaded);
      mockResolvePending.mockReturnValue({
        resolved: [
          {
            migration: loaded[0].migration,
            name: "20260220090000-init",
            status: "applied" as const,
            appliedChecksum: "hash",
          },
        ],
        ghosts: [],
      });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const result = await manager.apply();

      expect(mockExecuteUp).not.toHaveBeenCalled();
      expect(result.applied).toHaveLength(0);
      expect(result.skipped).toBe(1);
    });

    it("should throw on checksum mismatch", async () => {
      const loaded = [makeLoaded("20260220090000-init", "aaa")];
      mockLoadMigrations.mockResolvedValue(loaded);
      mockResolvePending.mockReturnValue({
        resolved: [
          {
            migration: loaded[0].migration,
            name: "20260220090000-init",
            status: "checksum_mismatch" as const,
            appliedChecksum: "old-hash",
          },
        ],
        ghosts: [],
      });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      await expect(manager.apply()).rejects.toThrow("Checksum mismatch detected");
    });

    it("should acquire advisory lock around entire apply sequence", async () => {
      mockResolvePending.mockReturnValue({ resolved: [], ghosts: [] });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      await manager.apply();

      expect(mockAdvisoryLock).toHaveBeenCalledTimes(1);
      expect(mockAdvisoryLock).toHaveBeenCalledWith(
        mockClient,
        expect.any(Number),
        expect.any(Number),
        expect.any(Function),
      );
    });

    it("should throw when advisory lock cannot be acquired", async () => {
      mockAdvisoryLock.mockResolvedValue(null);

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      await expect(manager.apply()).rejects.toThrow(
        "Could not acquire migration advisory lock",
      );
    });

    it("should throw PostgresMigrationError when partially applied migrations exist (finishedAt === null)", async () => {
      mockGetPartiallyApplied.mockResolvedValue([
        {
          id: "aaa",
          name: "20260220090000-init",
          checksum: "hash-xxx",
          createdAt: new Date(),
          startedAt: new Date("2026-02-20T09:00:00Z"),
          finishedAt: null,
          rolledBackAt: null,
        },
      ]);
      mockResolvePending.mockReturnValue({ resolved: [], ghosts: [] });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const thrown = await manager.apply().catch((e: unknown) => e);

      expect(thrown).toBeInstanceOf(PostgresMigrationError);
      expect((thrown as PostgresMigrationError).message).toContain(
        "Partially applied migrations detected",
      );
      expect(mockExecuteUp).not.toHaveBeenCalled();
    });
  });

  describe("rollback", () => {
    it("should roll back the most recently applied migration by default", async () => {
      const loaded = [
        makeLoaded("20260220090000-first", "aaa"),
        makeLoaded("20260221090000-second", "bbb"),
      ];
      mockLoadMigrations.mockResolvedValue(loaded);
      mockResolvePending.mockReturnValue({
        resolved: [
          {
            migration: loaded[0].migration,
            name: "20260220090000-first",
            status: "applied" as const,
            appliedChecksum: "h1",
          },
          {
            migration: loaded[1].migration,
            name: "20260221090000-second",
            status: "applied" as const,
            appliedChecksum: "h2",
          },
        ],
        ghosts: [],
      });
      mockExecuteDown.mockResolvedValue({ name: "test", durationMs: 5 });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const result = await manager.rollback();

      expect(mockExecuteDown).toHaveBeenCalledTimes(1);
      // Should roll back the LAST applied (bbb)
      expect(mockExecuteDown).toHaveBeenCalledWith(
        mockClient,
        loaded[1].migration,
        { name: "20260221090000-second" },
        undefined,
      );
      expect(result.applied).toHaveLength(1);
    });

    it("should roll back N migrations when count is specified", async () => {
      const loaded = [
        makeLoaded("20260220090000-first", "aaa"),
        makeLoaded("20260221090000-second", "bbb"),
      ];
      mockLoadMigrations.mockResolvedValue(loaded);
      mockResolvePending.mockReturnValue({
        resolved: [
          {
            migration: loaded[0].migration,
            name: "20260220090000-first",
            status: "applied" as const,
            appliedChecksum: "h1",
          },
          {
            migration: loaded[1].migration,
            name: "20260221090000-second",
            status: "applied" as const,
            appliedChecksum: "h2",
          },
        ],
        ghosts: [],
      });
      mockExecuteDown.mockResolvedValue({ name: "test", durationMs: 5 });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const result = await manager.rollback(2);

      expect(mockExecuteDown).toHaveBeenCalledTimes(2);
      expect(result.applied).toHaveLength(2);
    });

    it("should return empty result when no applied migrations", async () => {
      mockLoadMigrations.mockResolvedValue([]);
      mockResolvePending.mockReturnValue({ resolved: [], ghosts: [] });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const result = await manager.rollback();

      expect(mockExecuteDown).not.toHaveBeenCalled();
      expect(result.applied).toHaveLength(0);
    });

    it("should acquire advisory lock around entire rollback sequence", async () => {
      mockResolvePending.mockReturnValue({ resolved: [], ghosts: [] });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      await manager.rollback();

      expect(mockAdvisoryLock).toHaveBeenCalledTimes(1);
    });

    it("should throw PostgresMigrationError when partially applied migrations exist (finishedAt === null)", async () => {
      mockGetPartiallyApplied.mockResolvedValue([
        {
          id: "bbb",
          name: "20260221090000-second",
          checksum: "hash-xxx",
          createdAt: new Date(),
          startedAt: new Date("2026-02-21T09:00:00Z"),
          finishedAt: null,
          rolledBackAt: null,
        },
      ]);
      mockResolvePending.mockReturnValue({ resolved: [], ghosts: [] });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const thrown = await manager.rollback().catch((e: unknown) => e);

      expect(thrown).toBeInstanceOf(PostgresMigrationError);
      expect((thrown as PostgresMigrationError).message).toContain(
        "Partially applied migrations detected",
      );
      expect(mockExecuteDown).not.toHaveBeenCalled();
    });

    // P1-E: rollback() must guard against checksum_mismatch just like apply() does
    it("should throw PostgresMigrationError with checksum mismatch message when a resolved migration has checksum_mismatch status", async () => {
      const loaded = [makeLoaded("20260220090000-init", "aaa")];
      mockLoadMigrations.mockResolvedValue(loaded);
      mockResolvePending.mockReturnValue({
        resolved: [
          {
            migration: loaded[0].migration,
            name: "20260220090000-init",
            status: "checksum_mismatch" as const,
            appliedChecksum: "old-hash",
          },
        ],
        ghosts: [],
      });

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const thrown = await manager.rollback().catch((e: unknown) => e);

      expect(thrown).toBeInstanceOf(PostgresMigrationError);
      expect((thrown as PostgresMigrationError).message).toMatchSnapshot();
      expect((thrown as PostgresMigrationError).message).toContain("Checksum mismatch");
      expect(mockExecuteDown).not.toHaveBeenCalled();
    });
  });

  describe("getRecords", () => {
    it("should return all migration records", async () => {
      const records = [
        {
          id: "aaa",
          name: "20260220090000-init",
          checksum: "h",
          createdAt: new Date(),
          startedAt: new Date(),
          finishedAt: new Date(),
          rolledBackAt: null,
        },
      ];
      mockGetAllRecords.mockResolvedValue(records);

      const manager = new MigrationManager({
        client: mockClient,
        directory: "/migrations",
        logger: mockLogger,
      });

      const result = await manager.getRecords();

      expect(mockEnsureTable).toHaveBeenCalled();
      expect(result).toBe(records);
    });
  });
});
