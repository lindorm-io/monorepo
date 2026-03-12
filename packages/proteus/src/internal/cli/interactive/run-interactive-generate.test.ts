import type { SyncOperation } from "#internal/drivers/postgres/types/sync-plan";
import type { EntityGroup } from "./group-operations";
import { runInteractiveGenerate } from "./run-interactive-generate";
import { projectDesiredSchema } from "#internal/drivers/postgres/utils/sync/project-desired-schema";
import { introspectSchema } from "#internal/drivers/postgres/utils/sync/introspect-schema";
import { diffSchema } from "#internal/drivers/postgres/utils/sync/diff-schema";
import { serializeMigration } from "#internal/drivers/postgres/utils/migration/serialize-migration";
import { writeMigrationFile } from "#internal/drivers/postgres/utils/migration/write-migration-file";
import { groupOperationsByEntity } from "./group-operations";
import { filterOperationsByEntities } from "./filter-operations";
import { suggestMigrationName } from "./suggest-name";
import { previewOperations } from "./preview-operations";
import { Logger } from "@lindorm/logger";

jest.mock("#internal/drivers/postgres/utils/sync/project-desired-schema");
jest.mock("#internal/drivers/postgres/utils/sync/introspect-schema");
jest.mock("#internal/drivers/postgres/utils/sync/diff-schema");
jest.mock("#internal/drivers/postgres/utils/migration/serialize-migration");
jest.mock("#internal/drivers/postgres/utils/migration/write-migration-file");
jest.mock("./group-operations");
jest.mock("./filter-operations");
jest.mock("./suggest-name");
jest.mock("./preview-operations");

jest.mock("@lindorm/logger", () => ({
  Logger: {
    std: {
      log: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  },
}));

// Mock @inquirer/prompts with a factory that returns controllable functions
const mockCheckbox = jest.fn();
const mockInput = jest.fn();
const mockConfirm = jest.fn();

jest.mock("@inquirer/prompts", () => ({
  checkbox: (...args: unknown[]) => mockCheckbox(...args),
  input: (...args: unknown[]) => mockInput(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

const mockProjectDesiredSchema = projectDesiredSchema as jest.MockedFunction<
  typeof projectDesiredSchema
>;
const mockIntrospectSchema = introspectSchema as jest.MockedFunction<
  typeof introspectSchema
>;
const mockDiffSchema = diffSchema as jest.MockedFunction<typeof diffSchema>;
const mockSerializeMigration = serializeMigration as jest.MockedFunction<
  typeof serializeMigration
>;
const mockWriteMigrationFile = writeMigrationFile as jest.MockedFunction<
  typeof writeMigrationFile
>;
const mockGroupOperationsByEntity = groupOperationsByEntity as jest.MockedFunction<
  typeof groupOperationsByEntity
>;
const mockFilterOperationsByEntities = filterOperationsByEntities as jest.MockedFunction<
  typeof filterOperationsByEntities
>;
const mockSuggestMigrationName = suggestMigrationName as jest.MockedFunction<
  typeof suggestMigrationName
>;
const mockPreviewOperations = previewOperations as jest.MockedFunction<
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
  client: { query: jest.fn() },
  metadataList: [],
  source: { namespace: "app" },
  directory: "/project/migrations",
  ...overrides,
});

describe("runInteractiveGenerate", () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
