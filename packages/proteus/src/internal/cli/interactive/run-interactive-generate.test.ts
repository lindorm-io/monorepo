import type { SyncOperation } from "../../drivers/postgres/types/sync-plan.js";
import type { EntityGroup } from "./group-operations.js";
import { runInteractiveGenerate } from "./run-interactive-generate.js";
import { projectDesiredSchema } from "../../drivers/postgres/utils/sync/project-desired-schema.js";
import { introspectSchema } from "../../drivers/postgres/utils/sync/introspect-schema.js";
import { diffSchema } from "../../drivers/postgres/utils/sync/diff-schema.js";
import { serializeMigration } from "../../drivers/postgres/utils/migration/serialize-migration.js";
import { writeMigrationFile } from "../../drivers/postgres/utils/migration/write-migration-file.js";
import { groupOperationsByEntity } from "./group-operations.js";
import { filterOperationsByEntities } from "./filter-operations.js";
import { suggestMigrationName } from "./suggest-name.js";
import { previewOperations } from "./preview-operations.js";
import { Logger } from "@lindorm/logger";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

vi.mock("../../drivers/postgres/utils/sync/project-desired-schema.js");
vi.mock("../../drivers/postgres/utils/sync/introspect-schema.js");
vi.mock("../../drivers/postgres/utils/sync/diff-schema.js");
vi.mock("../../drivers/postgres/utils/migration/serialize-migration.js");
vi.mock("../../drivers/postgres/utils/migration/write-migration-file.js");
vi.mock("./group-operations.js");
vi.mock("./filter-operations.js");
vi.mock("./suggest-name.js");
vi.mock("./preview-operations.js");

vi.mock("@lindorm/logger", async () => ({
  Logger: {
    std: {
      log: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

// Mock @inquirer/prompts with a factory that returns controllable functions
const mockCheckbox = vi.fn();
const mockInput = vi.fn();
const mockConfirm = vi.fn();

vi.mock("@inquirer/prompts", () => ({
  checkbox: (...args: unknown[]) => mockCheckbox(...args),
  input: (...args: unknown[]) => mockInput(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

const mockProjectDesiredSchema = projectDesiredSchema as MockedFunction<
  typeof projectDesiredSchema
>;
const mockIntrospectSchema = introspectSchema as MockedFunction<typeof introspectSchema>;
const mockDiffSchema = diffSchema as MockedFunction<typeof diffSchema>;
const mockSerializeMigration = serializeMigration as MockedFunction<
  typeof serializeMigration
>;
const mockWriteMigrationFile = writeMigrationFile as MockedFunction<
  typeof writeMigrationFile
>;
const mockGroupOperationsByEntity = groupOperationsByEntity as MockedFunction<
  typeof groupOperationsByEntity
>;
const mockFilterOperationsByEntities = filterOperationsByEntities as MockedFunction<
  typeof filterOperationsByEntities
>;
const mockSuggestMigrationName = suggestMigrationName as MockedFunction<
  typeof suggestMigrationName
>;
const mockPreviewOperations = previewOperations as MockedFunction<
  typeof previewOperations
>;

const makeSyncOp = (overrides: Record<string, unknown> = {}): SyncOperation =>
  ({
    type: "add_column" as SyncOperation["type"],
    severity: "safe" as SyncOperation["severity"],
    schema: "public",
    table: "users",
    description: "add column id",
    sql: "ALTER TABLE ...",
    autocommit: false,
    ...overrides,
  }) as SyncOperation;

const makeGroup = (overrides: Record<string, unknown> = {}): EntityGroup =>
  ({
    entityName: "User",
    tableName: "public.users",
    operations: [makeSyncOp()],
    destructiveCount: 0,
    isJoinTable: false,
    ...overrides,
  }) as EntityGroup;

const makeOptions = (overrides: Record<string, unknown> = {}) => ({
  client: { query: vi.fn() },
  metadataList: [],
  source: { namespace: "app" },
  directory: "/project/migrations",
  ...overrides,
});

describe("runInteractiveGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const ops = [makeSyncOp()];
    mockProjectDesiredSchema.mockReturnValue({ tables: [] } as any);
    mockIntrospectSchema.mockResolvedValue({} as any);
    mockDiffSchema.mockReturnValue({
      operations: ops,
      summary: { safe: 1, warning: 0, destructive: 0, total: 1 },
    } as any);
    mockGroupOperationsByEntity.mockReturnValue({
      groups: [makeGroup()],
      ungrouped: [],
    });
    mockFilterOperationsByEntities.mockReturnValue(ops as any);
    mockSuggestMigrationName.mockReturnValue("add-user");
    mockPreviewOperations.mockReturnValue(
      "Operations (1):\n  safe         add column id",
    );
    mockInput.mockResolvedValue("add-user");
    mockConfirm.mockResolvedValue(true);
    mockSerializeMigration.mockReturnValue({
      filename: "20240101-add-user.ts",
      content: "// migration",
    } as any);
    mockWriteMigrationFile.mockResolvedValue("/project/migrations/20240101-add-user.ts");
  });

  it("should log no changes and return early when diff is empty", async () => {
    mockDiffSchema.mockReturnValue({ operations: [], summary: {} } as any);

    await runInteractiveGenerate(makeOptions() as any);

    expect(Logger.std.log).toHaveBeenCalledWith(
      "No schema changes detected — no migration generated.",
    );
    expect(mockGroupOperationsByEntity).not.toHaveBeenCalled();
  });

  it("should log no changes when groups and ungrouped are both empty", async () => {
    mockGroupOperationsByEntity.mockReturnValue({ groups: [], ungrouped: [] });

    await runInteractiveGenerate(makeOptions() as any);

    expect(Logger.std.log).toHaveBeenCalledWith(
      "No schema changes detected — no migration generated.",
    );
  });

  it("should skip checkbox prompt when only one group", async () => {
    await runInteractiveGenerate(makeOptions() as any);

    expect(mockCheckbox).not.toHaveBeenCalled();
  });

  it("should show checkbox prompt when more than one group", async () => {
    const group1 = makeGroup({ entityName: "User", tableName: "public.users" });
    const group2 = makeGroup({ entityName: "Post", tableName: "public.posts" });
    mockGroupOperationsByEntity.mockReturnValue({
      groups: [group1, group2],
      ungrouped: [],
    });
    mockCheckbox.mockResolvedValue([group1]);

    await runInteractiveGenerate(makeOptions() as any);

    expect(mockCheckbox).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Select entities to include in migration" }),
    );
  });

  it("should abort and return early when no entities selected from checkbox", async () => {
    const group1 = makeGroup({ entityName: "User", tableName: "public.users" });
    const group2 = makeGroup({ entityName: "Post", tableName: "public.posts" });
    mockGroupOperationsByEntity.mockReturnValue({
      groups: [group1, group2],
      ungrouped: [],
    });
    mockCheckbox.mockResolvedValue([]);

    await runInteractiveGenerate(makeOptions() as any);

    expect(Logger.std.log).toHaveBeenCalledWith("No entities selected — aborting.");
    expect(mockWriteMigrationFile).not.toHaveBeenCalled();
  });

  it("should display preview of filtered operations", async () => {
    await runInteractiveGenerate(makeOptions() as any);

    expect(mockPreviewOperations).toHaveBeenCalled();
    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("Operations (1):"),
    );
  });

  it("should prompt for migration name with suggested default", async () => {
    await runInteractiveGenerate(makeOptions() as any);

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Migration name:", default: "add-user" }),
    );
  });

  it("should prompt for confirmation to write the file", async () => {
    await runInteractiveGenerate(makeOptions() as any);

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("/project/migrations"),
      }),
    );
  });

  it("should abort without writing when user declines confirmation", async () => {
    mockConfirm.mockResolvedValue(false);

    await runInteractiveGenerate(makeOptions() as any);

    expect(Logger.std.log).toHaveBeenCalledWith("Aborted.");
    expect(mockWriteMigrationFile).not.toHaveBeenCalled();
  });

  it("should serialize and write migration file when confirmed", async () => {
    await runInteractiveGenerate(makeOptions() as any);

    expect(mockSerializeMigration).toHaveBeenCalled();
    expect(mockWriteMigrationFile).toHaveBeenCalledWith(
      "/project/migrations",
      "20240101-add-user.ts",
      "// migration",
    );
  });

  it("should log filename, location, and operation count after writing", async () => {
    await runInteractiveGenerate(makeOptions() as any);

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("20240101-add-user.ts"),
    );
    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("/project/migrations/20240101-add-user.ts"),
    );
  });

  it("should print warn_only operations via Logger.std.warn", async () => {
    const warnOp = makeSyncOp({
      type: "warn_only",
      severity: "warning",
      description: "manual index needed",
    });
    const safeOp = makeSyncOp();

    mockDiffSchema.mockReturnValue({
      operations: [warnOp, safeOp],
      summary: { safe: 1, warning: 1, destructive: 0, total: 2 },
    } as any);

    await runInteractiveGenerate(makeOptions() as any);

    expect(Logger.std.warn).toHaveBeenCalledWith(
      expect.stringContaining("manual index needed"),
    );
  });

  it("should use ungrouped operations when no groups exist", async () => {
    const ungroupedOp = makeSyncOp({ table: null });
    mockGroupOperationsByEntity.mockReturnValue({
      groups: [],
      ungrouped: [ungroupedOp] as any,
    });
    mockFilterOperationsByEntities.mockReturnValue([ungroupedOp] as any);

    await runInteractiveGenerate(makeOptions() as any);

    // When groups is empty, filtered ops = ungrouped
    expect(mockSerializeMigration).toHaveBeenCalled();
  });

  it("should pass migrationName from input to serializeMigration", async () => {
    mockInput.mockResolvedValue("custom-name");

    await runInteractiveGenerate(makeOptions() as any);

    expect(mockSerializeMigration).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { name: "custom-name" },
    );
  });

  it("should mark join table groups as join tables in checkbox choices", async () => {
    const joinGroup = makeGroup({
      entityName: "user_roles",
      isJoinTable: true,
      tableName: "public.user_roles",
    });
    const entityGroup = makeGroup({
      entityName: "User",
      isJoinTable: false,
      tableName: "public.users",
    });

    mockGroupOperationsByEntity.mockReturnValue({
      groups: [joinGroup, entityGroup],
      ungrouped: [],
    });
    mockCheckbox.mockResolvedValue([entityGroup]);

    await runInteractiveGenerate(makeOptions() as any);

    const choices: Array<{ name: string }> = mockCheckbox.mock.calls[0][0].choices;
    const joinChoice = choices.find((c) => c.name.includes("join table"));
    expect(joinChoice).toBeDefined();
  });
});
