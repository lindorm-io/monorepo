vi.mock("./prompts", async () => ({ runPrompts: vi.fn() }));
vi.mock("./scaffold", () => ({
  scaffold: vi.fn(),
  buildDependencyList: vi.fn(() => []),
  buildDevDependencyList: vi.fn(() => []),
}));
vi.mock("./install", () => ({
  installDependencies: vi.fn(),
  installDevDependencies: vi.fn(),
}));
vi.mock("./git", () => ({ initGit: vi.fn() }));
vi.mock("./drivers", () => ({
  runProteusInit: vi.fn(),
  runProteusGenerateSampleEntity: vi.fn(),
  runIrisInit: vi.fn(),
  runIrisGenerateSampleMessage: vi.fn(),
}));

import { runPrompts } from "./prompts";
import { scaffold } from "./scaffold";
import { installDependencies, installDevDependencies } from "./install";
import { initGit } from "./git";
import {
  runIrisGenerateSampleMessage,
  runIrisInit,
  runProteusGenerateSampleEntity,
  runProteusInit,
} from "./drivers";
import { run } from "./cli";
import type { Answers } from "./types";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type MockInstance,
} from "vitest";

const mockedRunPrompts = runPrompts as Mock;
const mockedScaffold = scaffold as Mock;
const mockedInstall = installDependencies as Mock;
const mockedInstallDev = installDevDependencies as Mock;
const mockedInitGit = initGit as Mock;
const mockedProteusInit = runProteusInit as Mock;
const mockedProteusSampleEntity = runProteusGenerateSampleEntity as Mock;
const mockedIrisInit = runIrisInit as Mock;
const mockedIrisSampleMessage = runIrisGenerateSampleMessage as Mock;

const baseAnswers = (overrides: Partial<Answers> = {}): Answers => ({
  projectName: "demo",
  projectDir: "/tmp/demo",
  features: {
    http: true,
    socket: false,
    webhooks: false,
    audit: false,
    session: false,
    auth: false,
    rateLimit: false,
  },
  proteusDriver: "none",
  irisDriver: "none",
  workers: [],
  ...overrides,
});

describe("cli run orchestration", () => {
  let stdout: MockInstance;

  beforeEach(() => {
    [
      mockedRunPrompts,
      mockedScaffold,
      mockedInstall,
      mockedInstallDev,
      mockedInitGit,
      mockedProteusInit,
      mockedProteusSampleEntity,
      mockedIrisInit,
      mockedIrisSampleMessage,
    ].forEach((m) => m.mockReset());

    [
      mockedScaffold,
      mockedInstall,
      mockedInstallDev,
      mockedInitGit,
      mockedProteusInit,
      mockedProteusSampleEntity,
      mockedIrisInit,
      mockedIrisSampleMessage,
    ].forEach((m) => m.mockResolvedValue(undefined));

    stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => stdout.mockRestore());

  test("minimal answers skip proteus and iris steps", async () => {
    mockedRunPrompts.mockResolvedValue(baseAnswers());
    await run();

    expect(mockedScaffold).toHaveBeenCalledTimes(1);
    expect(mockedInstall).toHaveBeenCalledTimes(1);
    expect(mockedInstallDev).toHaveBeenCalledTimes(1);
    expect(mockedProteusInit).not.toHaveBeenCalled();
    expect(mockedIrisInit).not.toHaveBeenCalled();
    expect(mockedInitGit).toHaveBeenCalledTimes(1);
  });

  test("runs proteus init + generate when driver selected", async () => {
    mockedRunPrompts.mockResolvedValue(baseAnswers({ proteusDriver: "postgres" }));
    await run();

    expect(mockedProteusInit).toHaveBeenCalledWith("/tmp/demo", "postgres");
    expect(mockedProteusSampleEntity).toHaveBeenCalledWith("/tmp/demo");
    expect(mockedIrisInit).not.toHaveBeenCalled();
  });

  test("runs iris init + generate when driver selected", async () => {
    mockedRunPrompts.mockResolvedValue(baseAnswers({ irisDriver: "rabbit" }));
    await run();

    expect(mockedIrisInit).toHaveBeenCalledWith("/tmp/demo", "rabbit");
    expect(mockedIrisSampleMessage).toHaveBeenCalledWith("/tmp/demo");
    expect(mockedProteusInit).not.toHaveBeenCalled();
  });

  test("orchestration order: scaffold → install → drivers → git", async () => {
    mockedRunPrompts.mockResolvedValue(
      baseAnswers({ proteusDriver: "postgres", irisDriver: "rabbit" }),
    );

    const calls: Array<string> = [];
    mockedScaffold.mockImplementation(async () => {
      calls.push("scaffold");
    });
    mockedInstall.mockImplementation(async () => {
      calls.push("install");
    });
    mockedInstallDev.mockImplementation(async () => {
      calls.push("install-dev");
    });
    mockedProteusInit.mockImplementation(async () => {
      calls.push("proteus-init");
    });
    mockedProteusSampleEntity.mockImplementation(async () => {
      calls.push("proteus-entity");
    });
    mockedIrisInit.mockImplementation(async () => {
      calls.push("iris-init");
    });
    mockedIrisSampleMessage.mockImplementation(async () => {
      calls.push("iris-msg");
    });
    mockedInitGit.mockImplementation(async () => {
      calls.push("git");
    });

    await run();

    expect(calls).toEqual([
      "scaffold",
      "install",
      "install-dev",
      "proteus-init",
      "proteus-entity",
      "iris-init",
      "iris-msg",
      "git",
    ]);
  });

  test("forwards positional name into prompts", async () => {
    mockedRunPrompts.mockResolvedValue(baseAnswers());
    await run("my-app");
    expect(mockedRunPrompts).toHaveBeenCalledWith({ positionalName: "my-app" });
  });
});
