import { Command } from "commander";
import { registerMigrateCommands } from "./migrate";
import { migrateGenerate } from "./migrate-generate";
import { migrateRun } from "./migrate-run";
import { migrateRollback } from "./migrate-rollback";
import { migrateStatus } from "./migrate-status";
import { migrateBaseline } from "./migrate-baseline";
import { migrateCreate } from "./migrate-create";
import { migrateResolve } from "./migrate-resolve";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("./migrate-generate", async () => ({ migrateGenerate: vi.fn() }));
vi.mock("./migrate-run", () => ({ migrateRun: vi.fn() }));
vi.mock("./migrate-rollback", () => ({ migrateRollback: vi.fn() }));
vi.mock("./migrate-status", () => ({ migrateStatus: vi.fn() }));
vi.mock("./migrate-baseline", () => ({ migrateBaseline: vi.fn() }));
vi.mock("./migrate-create", () => ({ migrateCreate: vi.fn() }));
vi.mock("./migrate-resolve", () => ({ migrateResolve: vi.fn() }));

const mockMigrateGenerate = migrateGenerate as MockedFunction<typeof migrateGenerate>;
const mockMigrateRun = migrateRun as MockedFunction<typeof migrateRun>;
const mockMigrateRollback = migrateRollback as MockedFunction<typeof migrateRollback>;
const mockMigrateStatus = migrateStatus as MockedFunction<typeof migrateStatus>;
const mockMigrateBaseline = migrateBaseline as MockedFunction<typeof migrateBaseline>;
const mockMigrateCreate = migrateCreate as MockedFunction<typeof migrateCreate>;
const mockMigrateResolve = migrateResolve as MockedFunction<typeof migrateResolve>;

describe("registerMigrateCommands", () => {
  let program: Command;

  const getMigrateCommand = () => program.commands.find((c) => c.name() === "migrate")!;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerMigrateCommands(program);

    mockMigrateGenerate.mockResolvedValue(undefined);
    mockMigrateRun.mockResolvedValue(undefined);
    mockMigrateRollback.mockResolvedValue(undefined);
    mockMigrateStatus.mockResolvedValue(undefined);
    mockMigrateBaseline.mockResolvedValue(undefined);
    mockMigrateCreate.mockResolvedValue(undefined);
    mockMigrateResolve.mockResolvedValue(undefined);
  });

  it("should register a 'migrate' subcommand", () => {
    expect(getMigrateCommand()).toBeDefined();
    expect(getMigrateCommand().description()).toBe("Migration management commands");
  });

  describe("migrate generate", () => {
    it("should register the 'generate' subcommand", () => {
      const cmd = getMigrateCommand().commands.find((c) => c.name() === "generate");
      expect(cmd).toBeDefined();
    });

    it("should wire migrateGenerate as action", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "generate"]);
      expect(mockMigrateGenerate).toHaveBeenCalledTimes(1);
    });

    it("should pass --name option", async () => {
      await program.parseAsync([
        "node",
        "proteus",
        "migrate",
        "generate",
        "--name",
        "my-migration",
      ]);
      const [opts] = mockMigrateGenerate.mock.calls[0];
      expect(opts).toMatchSnapshot();
    });

    it("should default --name to 'generated'", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "generate"]);
      const [opts] = mockMigrateGenerate.mock.calls[0];
      expect((opts as any).name).toBe("generated");
    });

    it("should pass --dry-run flag", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "generate", "--dry-run"]);
      const [opts] = mockMigrateGenerate.mock.calls[0];
      expect((opts as any).dryRun).toBe(true);
    });

    it("should pass --interactive flag", async () => {
      await program.parseAsync([
        "node",
        "proteus",
        "migrate",
        "generate",
        "--interactive",
      ]);
      const [opts] = mockMigrateGenerate.mock.calls[0];
      expect((opts as any).interactive).toBe(true);
    });
  });

  describe("migrate run", () => {
    it("should register the 'run' subcommand", () => {
      const cmd = getMigrateCommand().commands.find((c) => c.name() === "run");
      expect(cmd).toBeDefined();
    });

    it("should wire migrateRun as action", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "run"]);
      expect(mockMigrateRun).toHaveBeenCalledTimes(1);
    });

    it("should pass --verbose flag", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "run", "--verbose"]);
      const [opts] = mockMigrateRun.mock.calls[0];
      expect((opts as any).verbose).toBe(true);
    });
  });

  describe("migrate rollback", () => {
    it("should register the 'rollback' subcommand", () => {
      const cmd = getMigrateCommand().commands.find((c) => c.name() === "rollback");
      expect(cmd).toBeDefined();
    });

    it("should wire migrateRollback as action", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "rollback"]);
      expect(mockMigrateRollback).toHaveBeenCalledTimes(1);
    });

    it("should default --count to '1'", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "rollback"]);
      const [opts] = mockMigrateRollback.mock.calls[0];
      expect((opts as any).count).toBe("1");
    });

    it("should pass custom --count value", async () => {
      await program.parseAsync([
        "node",
        "proteus",
        "migrate",
        "rollback",
        "--count",
        "3",
      ]);
      const [opts] = mockMigrateRollback.mock.calls[0];
      expect((opts as any).count).toBe("3");
    });
  });

  describe("migrate status", () => {
    it("should register the 'status' subcommand", () => {
      const cmd = getMigrateCommand().commands.find((c) => c.name() === "status");
      expect(cmd).toBeDefined();
    });

    it("should wire migrateStatus as action", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "status"]);
      expect(mockMigrateStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("migrate baseline", () => {
    it("should register the 'baseline' subcommand", () => {
      const cmd = getMigrateCommand().commands.find((c) => c.name() === "baseline");
      expect(cmd).toBeDefined();
    });

    it("should wire migrateBaseline as action", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "baseline"]);
      expect(mockMigrateBaseline).toHaveBeenCalledTimes(1);
    });

    it("should default --name to 'baseline'", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "baseline"]);
      const [opts] = mockMigrateBaseline.mock.calls[0];
      expect((opts as any).name).toBe("baseline");
    });
  });

  describe("migrate create", () => {
    it("should register the 'create' subcommand", () => {
      const cmd = getMigrateCommand().commands.find((c) => c.name() === "create");
      expect(cmd).toBeDefined();
    });

    it("should wire migrateCreate as action", async () => {
      await program.parseAsync([
        "node",
        "proteus",
        "migrate",
        "create",
        "--name",
        "my-migration",
      ]);
      expect(mockMigrateCreate).toHaveBeenCalledTimes(1);
    });

    it("should pass --name as required option", async () => {
      await program.parseAsync([
        "node",
        "proteus",
        "migrate",
        "create",
        "--name",
        "add-users",
      ]);
      const [opts] = mockMigrateCreate.mock.calls[0];
      expect((opts as any).name).toBe("add-users");
    });
  });

  describe("migrate resolve", () => {
    it("should register the 'resolve' subcommand", () => {
      const cmd = getMigrateCommand().commands.find((c) => c.name() === "resolve");
      expect(cmd).toBeDefined();
    });

    it("should wire migrateResolve as action", async () => {
      await program.parseAsync(["node", "proteus", "migrate", "resolve"]);
      expect(mockMigrateResolve).toHaveBeenCalledTimes(1);
    });

    it("should pass --applied option", async () => {
      await program.parseAsync([
        "node",
        "proteus",
        "migrate",
        "resolve",
        "--applied",
        "my-migration",
      ]);
      const [opts] = mockMigrateResolve.mock.calls[0];
      expect((opts as any).applied).toBe("my-migration");
    });

    it("should pass --rolled-back option", async () => {
      await program.parseAsync([
        "node",
        "proteus",
        "migrate",
        "resolve",
        "--rolled-back",
        "old-migration",
      ]);
      const [opts] = mockMigrateResolve.mock.calls[0];
      expect((opts as any).rolledBack).toBe("old-migration");
    });
  });
});
