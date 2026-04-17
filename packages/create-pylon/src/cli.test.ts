jest.mock("./prompts", () => ({ runPrompts: jest.fn() }));
jest.mock("./scaffold", () => ({
  scaffold: jest.fn(),
  buildDependencyList: jest.fn(() => []),
  buildDevDependencyList: jest.fn(() => []),
}));
jest.mock("./install", () => ({
  installDependencies: jest.fn(),
  installDevDependencies: jest.fn(),
}));
jest.mock("./git", () => ({ initGit: jest.fn() }));
jest.mock("./drivers", () => ({
  runProteusInit: jest.fn(),
  runProteusGenerateSampleEntity: jest.fn(),
  runIrisInit: jest.fn(),
  runIrisGenerateSampleMessage: jest.fn(),
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

const mockedRunPrompts = runPrompts as jest.Mock;
const mockedScaffold = scaffold as jest.Mock;
const mockedInstall = installDependencies as jest.Mock;
const mockedInstallDev = installDevDependencies as jest.Mock;
const mockedInitGit = initGit as jest.Mock;
const mockedProteusInit = runProteusInit as jest.Mock;
const mockedProteusSampleEntity = runProteusGenerateSampleEntity as jest.Mock;
const mockedIrisInit = runIrisInit as jest.Mock;
const mockedIrisSampleMessage = runIrisGenerateSampleMessage as jest.Mock;

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
  let stdout: jest.SpyInstance;

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

    stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
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
