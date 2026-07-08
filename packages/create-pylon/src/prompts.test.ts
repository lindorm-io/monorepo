import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runPrompts } from "./prompts.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("@inquirer/prompts", async () => ({
  input: vi.fn(),
  checkbox: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
}));

import { checkbox, confirm, input, select } from "@inquirer/prompts";

const mockedInput = input as unknown as Mock;
const mockedCheckbox = checkbox as unknown as Mock;
const mockedSelect = select as unknown as Mock;
const mockedConfirm = confirm as unknown as Mock;

const queueSequence = (mock: Mock, values: Array<unknown>): void => {
  for (const value of values) mock.mockResolvedValueOnce(value);
};

// Prompt order:
//   0. input    — project name (only when no positional name)
//   1. input    — issuer URL
//   2. checkbox — features (http/socket)
//   3. select   — db driver (Proteus DB source)
//   4. select   — kv driver (Proteus KV source)
//   5. select   — iris driver
//   6. confirm  — webhooks (if both proteus+iris)
//   7. confirm  — audit    (if both proteus+iris)
//   8. confirm  — auth
//   9. confirm  — rate limit (if kv !== none)
//  10. checkbox — workers (if proteus)

describe("runPrompts", () => {
  let sandboxDir: string;

  beforeEach(() => {
    mockedInput.mockReset();
    // Base return for the issuer prompt (and any input not queued explicitly);
    // per-call `mockResolvedValueOnce` (e.g. the name prompt) still takes priority.
    mockedInput.mockResolvedValue("http://localhost:3000");
    mockedCheckbox.mockReset();
    mockedSelect.mockReset();
    mockedConfirm.mockReset();
    sandboxDir = join(tmpdir(), `create-pylon-prompts-${Date.now()}-${Math.random()}`);
    mkdirSync(sandboxDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(sandboxDir, { recursive: true, force: true });
  });

  test("returns answers with positional name and defaults", async () => {
    queueSequence(mockedCheckbox, [["http"]]);
    queueSequence(mockedSelect, ["none", "none", "none"]);
    queueSequence(mockedConfirm, [false]);

    const answers = await runPrompts({ positionalName: "my-app", cwd: sandboxDir });

    expect({
      ...answers,
      projectDir: answers.projectDir.endsWith("my-app")
        ? "<cwd>/my-app"
        : answers.projectDir,
    }).toMatchSnapshot();
  });

  test("scoped positional name keeps the scope but scaffolds into the basename dir (F9)", async () => {
    queueSequence(mockedCheckbox, [["http"]]);
    queueSequence(mockedSelect, ["none", "none", "none"]);
    queueSequence(mockedConfirm, [false]);

    const answers = await runPrompts({ positionalName: "@acme/proxy", cwd: sandboxDir });

    expect(answers.projectName).toBe("@acme/proxy");
    expect(answers.projectDir.endsWith("/proxy")).toBe(true);
    expect(answers.projectDir).not.toContain("@acme");
  });

  test("prompts for name when positional missing", async () => {
    mockedInput.mockResolvedValueOnce("prompted-name");
    queueSequence(mockedCheckbox, [["http", "socket"]]);
    queueSequence(mockedSelect, ["none", "none", "none"]);
    queueSequence(mockedConfirm, [false]);

    const answers = await runPrompts({ cwd: sandboxDir });

    expect(mockedInput).toHaveBeenCalled();
    expect(answers.projectName).toBe("prompted-name");
    expect(answers.features).toMatchSnapshot();
  });

  test("prompts webhooks and audit only when both proteus and iris selected", async () => {
    queueSequence(mockedCheckbox, [["http"], ["expiry-cleanup"]]);
    queueSequence(mockedSelect, ["postgres", "redis", "rabbit"]);
    // webhooks, audit, auth, rateLimit
    queueSequence(mockedConfirm, [true, true, false, false]);

    const answers = await runPrompts({ positionalName: "full-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(4);
    expect(answers.features.webhooks).toBe(true);
    expect(answers.features.audit).toBe(true);
    expect(answers.db).toBe("postgres");
    expect(answers.kv).toBe("redis");
    expect(answers.irisDriver).toBe("rabbit");
    expect(answers.workers).toMatchSnapshot();
  });

  test("skips webhooks and audit prompts when iris is none", async () => {
    queueSequence(mockedCheckbox, [["http"], ["expiry-cleanup"]]);
    queueSequence(mockedSelect, ["postgres", "none", "none"]);
    // auth only (no webhooks/audit, no rateLimit — kv is none)
    queueSequence(mockedConfirm, [false]);

    const answers = await runPrompts({ positionalName: "partial-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(answers.features.webhooks).toBe(false);
    expect(answers.features.audit).toBe(false);
  });

  test("skips workers prompt entirely when neither db nor kv is selected", async () => {
    queueSequence(mockedCheckbox, [["http"]]);
    queueSequence(mockedSelect, ["none", "none", "none"]);
    queueSequence(mockedConfirm, [false]);

    const answers = await runPrompts({
      positionalName: "no-workers-app",
      cwd: sandboxDir,
    });

    expect(mockedCheckbox).toHaveBeenCalledTimes(1);
    expect(answers.workers).toEqual([]);
  });

  test("auth prompt implies session — picking auth sets both", async () => {
    queueSequence(mockedCheckbox, [["http"]]);
    queueSequence(mockedSelect, ["none", "none", "none"]);
    // auth=true (rateLimit skipped — kv is none)
    queueSequence(mockedConfirm, [true]);

    const answers = await runPrompts({ positionalName: "a-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(answers.features.auth).toBe(true);
    expect(answers.features.session).toBe(true);
  });

  test("declining auth leaves both session and auth off", async () => {
    queueSequence(mockedCheckbox, [["http"]]);
    queueSequence(mockedSelect, ["none", "none", "none"]);
    // auth=false (rateLimit skipped — kv is none)
    queueSequence(mockedConfirm, [false]);

    const answers = await runPrompts({ positionalName: "no-a-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(answers.features.auth).toBe(false);
    expect(answers.features.session).toBe(false);
  });

  test("rate limit prompt shown when kv is redis", async () => {
    queueSequence(mockedCheckbox, [["http"], []]);
    queueSequence(mockedSelect, ["none", "redis", "none"]);
    // auth, rateLimit
    queueSequence(mockedConfirm, [false, true]);

    const answers = await runPrompts({ positionalName: "rl-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(2);
    expect(answers.features.rateLimit).toBe(true);
  });

  test("rate limit prompt shown when kv is memory", async () => {
    queueSequence(mockedCheckbox, [["http"], []]);
    queueSequence(mockedSelect, ["none", "memory", "none"]);
    // auth, rateLimit
    queueSequence(mockedConfirm, [false, true]);

    const answers = await runPrompts({ positionalName: "rl-mem-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(2);
    expect(answers.features.rateLimit).toBe(true);
  });

  test("rate limit prompt skipped when only a db driver is selected", async () => {
    queueSequence(mockedCheckbox, [["http"], []]);
    queueSequence(mockedSelect, ["postgres", "none", "none"]);
    // auth only — no kv store, so no rate limiting
    queueSequence(mockedConfirm, [false]);

    const answers = await runPrompts({ positionalName: "no-rl-pg-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(answers.features.rateLimit).toBe(false);
  });

  test("rate limit prompt skipped when neither db nor kv is selected", async () => {
    queueSequence(mockedCheckbox, [["http"]]);
    queueSequence(mockedSelect, ["none", "none", "none"]);
    // auth only
    queueSequence(mockedConfirm, [false]);

    const answers = await runPrompts({ positionalName: "no-rl-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(answers.features.rateLimit).toBe(false);
  });

  test("cancels when user declines to remove existing directory", async () => {
    const existing = join(sandboxDir, "existing-app");
    mkdirSync(existing);
    writeFileSync(join(existing, "file.txt"), "x");

    mockedSelect.mockResolvedValueOnce("cancel");

    await expect(
      runPrompts({ positionalName: "existing-app", cwd: sandboxDir }),
    ).rejects.toThrow("Operation cancelled by user");
  });
});
