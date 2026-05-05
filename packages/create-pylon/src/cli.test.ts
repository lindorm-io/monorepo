vi.mock("./prompts.js", async () => ({ runPrompts: vi.fn() }));
vi.mock("./scaffold.js", () => ({
  scaffold: vi.fn(),
  buildDependencyList: vi.fn(() => []),
  buildDevDependencyList: vi.fn(() => []),
  needsDockerCompose: vi.fn(() => false),
}));
vi.mock("./install.js", () => ({
  installDependencies: vi.fn(),
  installDevDependencies: vi.fn(),
}));
vi.mock("./git.js", () => ({ initGit: vi.fn() }));
vi.mock("./drivers.js", () => ({
  runProteusInit: vi.fn(),
  runProteusGenerateSampleEntity: vi.fn(),
  runIrisInit: vi.fn(),
  runIrisGenerateSampleMessage: vi.fn(),
}));

import { runPrompts } from "./prompts.js";
import { needsDockerCompose, scaffold } from "./scaffold.js";
import { installDependencies, installDevDependencies } from "./install.js";
import { initGit } from "./git.js";
import {
  runIrisGenerateSampleMessage,
  runIrisInit,
  runProteusGenerateSampleEntity,
  runProteusInit,
} from "./drivers.js";
import { run } from "./cli.js";
import type { Answers } from "./types.js";
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
const mockedNeedsDockerCompose = needsDockerCompose as Mock;
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
  proteusDrivers: [],
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
      mockedNeedsDockerCompose,
    ].forEach((m) => m.mockReset());

    mockedNeedsDockerCompose.mockReturnValue(false);

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
    mockedRunPrompts.mockResolvedValue(baseAnswers({ proteusDrivers: ["postgres"] }));
    await run();

    expect(mockedProteusInit).toHaveBeenCalledWith(
      "/tmp/demo",
      expect.objectContaining({ proteusDrivers: ["postgres"] }),
    );
    expect(mockedProteusSampleEntity).toHaveBeenCalledWith("/tmp/demo", undefined);
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
      baseAnswers({ proteusDrivers: ["postgres"], irisDriver: "rabbit" }),
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

  test("next steps include docker:up when a compose file is generated", async () => {
    mockedRunPrompts.mockResolvedValue(baseAnswers({ proteusDrivers: ["postgres"] }));
    mockedNeedsDockerCompose.mockReturnValue(true);

    await run();

    const written = stdout.mock.calls.map(([s]) => String(s)).join("");
    expect(written).toContain("npm run docker:up");
    expect(written.indexOf("npm run docker:up")).toBeLessThan(
      written.indexOf("npm run dev"),
    );
  });

  test("next steps omit docker:up when no compose file is generated", async () => {
    mockedRunPrompts.mockResolvedValue(baseAnswers());
    mockedNeedsDockerCompose.mockReturnValue(false);

    await run();

    const written = stdout.mock.calls.map(([s]) => String(s)).join("");
    expect(written).not.toContain("docker:up");
  });
});
