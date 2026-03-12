import { resolve } from "path";
import { migrateCreate } from "./migrate-create";
import { withSourceConfig } from "../with-source";
import { writeMigrationFile } from "#internal/utils/migration/write-migration-file";
import { formatTimestamp, sanitizeName, kebabToPascal } from "../utils/migration-naming";
import { Logger } from "@lindorm/logger";

jest.mock("../with-source");
jest.mock("#internal/utils/migration/write-migration-file");
jest.mock("../utils/migration-naming", () => ({
  formatTimestamp: jest.fn(),
  sanitizeName: jest.fn(),
  kebabToPascal: jest.fn(),
}));
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid-1234"),
}));

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

const mockWithSourceConfig = withSourceConfig as jest.MockedFunction<
  typeof withSourceConfig
>;
const mockWriteMigrationFile = writeMigrationFile as jest.MockedFunction<
  typeof writeMigrationFile
>;
const mockFormatTimestamp = formatTimestamp as jest.MockedFunction<
  typeof formatTimestamp
>;
const mockSanitizeName = sanitizeName as jest.MockedFunction<typeof sanitizeName>;
const mockKebabToPascal = kebabToPascal as jest.MockedFunction<typeof kebabToPascal>;

const defaultDir = resolve(process.cwd(), "./migrations");

const makeSource = (overrides: Record<string, unknown> = {}) => ({
  namespace: "myapp",
  driverType: "postgres",
  migrationsTable: undefined,
  getEntityMetadata: jest.fn().mockReturnValue([]),
  ...overrides,
});

describe("migrateCreate", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockWithSourceConfig.mockImplementation(async (_opts, fn) => {
      await fn({ source: makeSource() } as any);
    });

    mockFormatTimestamp.mockReturnValue("20240115120000");
    mockSanitizeName.mockReturnValue("add-users");
    mockKebabToPascal.mockReturnValue("AddUsers");
    mockWriteMigrationFile.mockResolvedValue(`${defaultDir}/20240115120000-add-users.ts`);
  });

  it("should call withSourceConfig with the provided options", async () => {
    await migrateCreate({ name: "add-users", source: "/config.ts" });

    expect(mockWithSourceConfig).toHaveBeenCalledWith(
      expect.objectContaining({ source: "/config.ts" }),
      expect.any(Function),
    );
  });

  it("should sanitize the provided name", async () => {
    await migrateCreate({ name: "Add Users!", source: "/config.ts" });

    expect(mockSanitizeName).toHaveBeenCalledWith("Add Users!");
  });

  it("should throw when sanitized name is empty", async () => {
    mockSanitizeName.mockReturnValue("");

    await expect(migrateCreate({ name: "---", source: "/config.ts" })).rejects.toThrow(
      "Migration name must contain at least one alphanumeric character",
    );
  });

  it("should convert slug to PascalCase for class name", async () => {
    await migrateCreate({ name: "add-users", source: "/config.ts" });

    expect(mockKebabToPascal).toHaveBeenCalledWith("add-users");
  });

  it("should write migration file to default migrations directory", async () => {
    await migrateCreate({ name: "add-users", source: "/config.ts" });

    expect(mockWriteMigrationFile).toHaveBeenCalledWith(
      defaultDir,
      "20240115120000-add-users.ts",
      expect.any(String),
    );
  });

  it("should use options.directory when provided", async () => {
    await migrateCreate({
      name: "add-users",
      source: "/config.ts",
      directory: "./custom",
    });

    expect(mockWriteMigrationFile).toHaveBeenCalledWith(
      resolve(process.cwd(), "./custom"),
      expect.any(String),
      expect.any(String),
    );
  });

  it("should write file content with SqlMigrationRunner and driver field", async () => {
    await migrateCreate({ name: "add-users", source: "/config.ts" });

    const content: string = mockWriteMigrationFile.mock.calls[0][2];

    expect(content).toContain("export class AddUsers");
    expect(content).toContain("public async up(runner: SqlMigrationRunner)");
    expect(content).toContain("public async down(runner: SqlMigrationRunner)");
    expect(content).toContain('public readonly driver = "postgres"');
    expect(content).toContain("// TODO: implement");
  });

  it("should embed randomUUID in the file content", async () => {
    await migrateCreate({ name: "add-users", source: "/config.ts" });

    const content: string = mockWriteMigrationFile.mock.calls[0][2];

    expect(content).toContain("test-uuid-1234");
  });

  it("should log the created filename and location", async () => {
    await migrateCreate({ name: "add-users", source: "/config.ts" });

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("20240115120000-add-users.ts"),
    );
    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("20240115120000-add-users.ts"),
    );
  });

  it("should use source driverType in the generated driver field", async () => {
    mockWithSourceConfig.mockImplementation(async (_opts, fn) => {
      await fn({ source: makeSource({ driverType: "mysql" }) } as any);
    });

    await migrateCreate({ name: "add-users", source: "/config.ts" });

    const content: string = mockWriteMigrationFile.mock.calls[0][2];

    expect(content).toContain('public readonly driver = "mysql"');
  });
});
