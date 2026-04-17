import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runPrompts } from "./prompts";

jest.mock("@inquirer/prompts", () => ({
  input: jest.fn(),
  checkbox: jest.fn(),
  select: jest.fn(),
  confirm: jest.fn(),
}));

import { checkbox, confirm, input, select } from "@inquirer/prompts";

const mockedInput = input as unknown as jest.Mock;
const mockedCheckbox = checkbox as unknown as jest.Mock;
const mockedSelect = select as unknown as jest.Mock;
const mockedConfirm = confirm as unknown as jest.Mock;

const queueSequence = (mock: jest.Mock, values: Array<unknown>): void => {
  for (const value of values) mock.mockResolvedValueOnce(value);
};

describe("runPrompts", () => {
  let sandboxDir: string;

  beforeEach(() => {
    mockedInput.mockReset();
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
    queueSequence(mockedCheckbox, [["http"], []]);
    queueSequence(mockedSelect, ["none", "none"]);
    queueSequence(mockedConfirm, [false, false]);

    const answers = await runPrompts({ positionalName: "my-app", cwd: sandboxDir });

    expect({
      ...answers,
      projectDir: answers.projectDir.endsWith("my-app")
        ? "<cwd>/my-app"
        : answers.projectDir,
    }).toMatchSnapshot();
  });

  test("prompts for name when positional missing", async () => {
    mockedInput.mockResolvedValueOnce("prompted-name");
    queueSequence(mockedCheckbox, [["http", "socket"], ["amphora-refresh"]]);
    queueSequence(mockedSelect, ["none", "none"]);
    queueSequence(mockedConfirm, [false, false]);

    const answers = await runPrompts({ cwd: sandboxDir });

    expect(mockedInput).toHaveBeenCalled();
    expect(answers.projectName).toBe("prompted-name");
    expect(answers.features).toMatchSnapshot();
  });

  test("prompts webhooks and audit only when both drivers selected", async () => {
    queueSequence(mockedCheckbox, [["http"], ["amphora-refresh", "expiry-cleanup"]]);
    queueSequence(mockedSelect, ["postgres", "rabbit"]);
    // webhooks, audit, session, auth, rateLimit
    queueSequence(mockedConfirm, [true, true, false, false, false]);

    const answers = await runPrompts({ positionalName: "full-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(5);
    expect(answers.features.webhooks).toBe(true);
    expect(answers.features.audit).toBe(true);
    expect(answers.proteusDriver).toBe("postgres");
    expect(answers.irisDriver).toBe("rabbit");
    expect(answers.workers).toMatchSnapshot();
  });

  test("skips webhooks and audit prompts when iris is none", async () => {
    queueSequence(mockedCheckbox, [["http"], ["amphora-refresh"]]);
    queueSequence(mockedSelect, ["postgres", "none"]);
    // session, auth, rateLimit (no webhooks/audit)
    queueSequence(mockedConfirm, [false, false, false]);

    const answers = await runPrompts({ positionalName: "partial-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(3);
    expect(answers.features.webhooks).toBe(false);
    expect(answers.features.audit).toBe(false);
  });

  test("session and auth prompts always shown regardless of drivers", async () => {
    queueSequence(mockedCheckbox, [["http"], []]);
    queueSequence(mockedSelect, ["none", "none"]);
    // session, auth (rateLimit skipped — no proteus)
    queueSequence(mockedConfirm, [true, false]);

    const answers = await runPrompts({ positionalName: "s-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(2);
    expect(answers.features.session).toBe(true);
    expect(answers.features.auth).toBe(false);
    expect(answers.features.rateLimit).toBe(false);
  });

  test("rate limit prompt only shown when proteus selected", async () => {
    queueSequence(mockedCheckbox, [["http"], []]);
    queueSequence(mockedSelect, ["postgres", "none"]);
    // session, auth, rateLimit
    queueSequence(mockedConfirm, [false, false, true]);

    const answers = await runPrompts({ positionalName: "rl-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(3);
    expect(answers.features.rateLimit).toBe(true);
  });

  test("rate limit prompt skipped when proteus is none", async () => {
    queueSequence(mockedCheckbox, [["http"], []]);
    queueSequence(mockedSelect, ["none", "none"]);
    // session, auth only
    queueSequence(mockedConfirm, [false, false]);

    const answers = await runPrompts({ positionalName: "no-rl-app", cwd: sandboxDir });

    expect(mockedConfirm).toHaveBeenCalledTimes(2);
    expect(answers.features.rateLimit).toBe(false);
  });

  test("auto-forces session when auth selected without session", async () => {
    const writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      queueSequence(mockedCheckbox, [["http"], []]);
      queueSequence(mockedSelect, ["none", "none"]);
      // session=false, auth=true
      queueSequence(mockedConfirm, [false, true]);

      const answers = await runPrompts({ positionalName: "a-app", cwd: sandboxDir });

      expect(answers.features.auth).toBe(true);
      expect(answers.features.session).toBe(true);
      expect(writeSpy).toHaveBeenCalledWith(
        "Sessions auto-enabled (required by OIDC auth).\n",
      );
    } finally {
      writeSpy.mockRestore();
    }
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
