import { Logger as _Logger } from "@lindorm/logger";
import { access as _access, writeFile as _writeFile } from "fs/promises";
import { resolve } from "path";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { configInit } from "./config-init.js";

vi.mock("fs/promises", async () => ({
  access: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lindorm/logger", () => ({
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

const access = _access as unknown as Mock;
const writeFile = _writeFile as unknown as Mock;
const Logger = _Logger as unknown as {
  std: { log: Mock; info: Mock; warn: Mock };
};

const target = resolve(process.cwd(), "lindorm.config.ts");

describe("configInit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes lindorm.config.ts when absent", async () => {
    access.mockRejectedValue(new Error("ENOENT"));

    await configInit({});

    expect(writeFile).toHaveBeenCalledWith(
      target,
      expect.stringContaining("defineConfig"),
      "utf-8",
    );
    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created lindorm.config.ts"),
    );
  });

  it("skips when present without --force", async () => {
    access.mockResolvedValue(undefined);

    await configInit({});

    expect(writeFile).not.toHaveBeenCalled();
    expect(Logger.std.warn).toHaveBeenCalledWith(
      expect.stringContaining("already exists"),
    );
  });

  it("overwrites when present with --force", async () => {
    access.mockResolvedValue(undefined);

    await configInit({ force: true });

    expect(writeFile).toHaveBeenCalledWith(
      target,
      expect.stringContaining("defineConfig"),
      "utf-8",
    );
  });

  it("writes nothing in dry-run mode", async () => {
    access.mockRejectedValue(new Error("ENOENT"));

    await configInit({ dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("defineConfig"));
  });
});
