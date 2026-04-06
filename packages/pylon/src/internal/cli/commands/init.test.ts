import { resolve, join } from "path";

const mockConfirm = jest.fn();

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
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

jest.mock("@inquirer/prompts", () => ({
  confirm: mockConfirm,
}));

const { mkdir, writeFile } = jest.requireMock("fs/promises");
const { Logger } = jest.requireMock("@lindorm/logger");

import { init } from "./init";

const defaultDir = resolve(process.cwd(), ".");

const allTrue = (): void => {
  mockConfirm.mockResolvedValue(true);
};

const allFalse = (): void => {
  mockConfirm.mockResolvedValue(false);
};

const withAnswers = (answers: Record<string, boolean>): void => {
  const keys = [
    "HTTP routes?",
    "Socket.IO listeners?",
    "Session support?",
    "Auth/OIDC?",
    "Webhooks?",
    "Job queue?",
    "Rate limiting?",
  ];

  mockConfirm.mockImplementation(({ message }: { message: string }) => {
    for (const [key, val] of Object.entries(answers)) {
      if (message === key) return Promise.resolve(val);
    }
    return Promise.resolve(false);
  });
};

describe("init", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create logger file", async () => {
    allTrue();
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "logger", "index.ts"),
      expect.stringContaining("new Logger()"),
      "utf-8",
    );
  });

  it("should create amphora file", async () => {
    allTrue();
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "pylon", "amphora.ts"),
      expect.stringContaining("new Amphora"),
      "utf-8",
    );
  });

  it("should create config file", async () => {
    allTrue();
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "pylon", "config.ts"),
      expect.stringContaining("configuration"),
      "utf-8",
    );
  });

  it("should create pylon file", async () => {
    allTrue();
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "pylon", "pylon.ts"),
      expect.stringContaining("new Pylon"),
      "utf-8",
    );
  });

  it("should create index file", async () => {
    allTrue();
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "index.ts"),
      expect.stringContaining("pylon.start()"),
      "utf-8",
    );
  });

  it("should create node config json", async () => {
    allTrue();
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "config", ".node_config.json"),
      expect.stringContaining('"port": 3000'),
      "utf-8",
    );
  });

  it("should create context types file", async () => {
    allTrue();
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "types", "context.ts"),
      expect.stringContaining("ServerHttpContext"),
      "utf-8",
    );
  });

  it("should create .gitkeep files for handlers, middleware, workers", async () => {
    allTrue();
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "handlers", ".gitkeep"),
      "",
      "utf-8",
    );
    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "middleware", ".gitkeep"),
      "",
      "utf-8",
    );
    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "workers", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should include routes config when routes answer is true", async () => {
    withAnswers({ "HTTP routes?": true });
    await init({});

    const pylonContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("pylon.ts"),
    )?.[1] as string;

    expect(pylonContent).toContain("routes:");
  });

  it("should create route middleware and example route when routes is true", async () => {
    withAnswers({ "HTTP routes?": true });
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "routes", "_middleware.ts"),
      expect.stringContaining("ServerHttpMiddleware"),
      "utf-8",
    );
    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "routes", "hello-there.ts"),
      expect.stringContaining("General Kenobi"),
      "utf-8",
    );
  });

  it("should not create route files when routes is false", async () => {
    allFalse();
    await init({});

    const routeCalls = writeFile.mock.calls.filter((c: Array<unknown>) =>
      (c[0] as string).includes("/routes/"),
    );

    expect(routeCalls).toHaveLength(0);
  });

  it("should include socket config when listeners answer is true", async () => {
    withAnswers({ "Socket.IO listeners?": true });
    await init({});

    const pylonContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("pylon.ts"),
    )?.[1] as string;

    expect(pylonContent).toContain("socket: {");
    expect(pylonContent).toContain("enabled: true,");
    expect(pylonContent).toContain("listeners:");
  });

  it("should create listener middleware when listeners is true", async () => {
    withAnswers({ "Socket.IO listeners?": true });
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "src", "listeners", "_middleware.ts"),
      expect.stringContaining("ServerSocketMiddleware"),
      "utf-8",
    );
  });

  it("should not create listener files when listeners is false", async () => {
    allFalse();
    await init({});

    const listenerCalls = writeFile.mock.calls.filter((c: Array<unknown>) =>
      (c[0] as string).includes("/listeners/"),
    );

    expect(listenerCalls).toHaveLength(0);
  });

  it("should include session config when session answer is true", async () => {
    withAnswers({ "Session support?": true });
    await init({});

    const pylonContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("pylon.ts"),
    )?.[1] as string;

    expect(pylonContent).toContain("session: {");
    expect(pylonContent).toContain("enabled: true,");
  });

  it("should include auth config when auth answer is true", async () => {
    withAnswers({ "Auth/OIDC?": true });
    await init({});

    const pylonContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("pylon.ts"),
    )?.[1] as string;

    expect(pylonContent).toContain("auth: {");
    expect(pylonContent).toContain("config.oidcIssuer");
    expect(pylonContent).toContain("config.oidcClientId");
    expect(pylonContent).toContain("config.oidcClientSecret");

    const configContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("config.ts"),
    )?.[1] as string;

    expect(configContent).toContain("oidcIssuer:");
    expect(configContent).toContain("oidcClientId:");
    expect(configContent).toContain("oidcClientSecret:");
  });

  it("should include webhook config when webhooks answer is true", async () => {
    withAnswers({ "Webhooks?": true });
    await init({});

    const pylonContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("pylon.ts"),
    )?.[1] as string;

    expect(pylonContent).toContain("webhook: {");
    expect(pylonContent).toContain("enabled: true,");
  });

  it("should include queue config when queue answer is true", async () => {
    withAnswers({ "Job queue?": true });
    await init({});

    const pylonContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("pylon.ts"),
    )?.[1] as string;

    expect(pylonContent).toContain("queue: {");
    expect(pylonContent).toContain("enabled: true,");
  });

  it("should include rateLimit config when rateLimit answer is true", async () => {
    withAnswers({ "Rate limiting?": true });
    await init({});

    const pylonContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("pylon.ts"),
    )?.[1] as string;

    expect(pylonContent).toContain("rateLimit: {");
    expect(pylonContent).toContain("enabled: true,");
  });

  it("should not include optional configs when all answers are false", async () => {
    allFalse();
    await init({});

    const pylonContent = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("pylon.ts"),
    )?.[1] as string;

    expect(pylonContent).not.toContain("routes:");
    expect(pylonContent).not.toContain("socket:");
    expect(pylonContent).not.toContain("session:");
    expect(pylonContent).not.toContain("auth:");
    expect(pylonContent).not.toContain("webhook:");
    expect(pylonContent).not.toContain("queue:");
    expect(pylonContent).not.toContain("rateLimit:");
  });

  it("should use custom directory when provided", async () => {
    allFalse();
    await init({ directory: "./custom/path" });

    const customDir = resolve(process.cwd(), "./custom/path");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "src", "pylon", "pylon.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should not write files in dry-run mode", async () => {
    allFalse();
    await init({ dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log file paths in dry-run mode", async () => {
    allFalse();
    await init({ dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("pylon.ts"));
  });

  it("should create directories with mkdir recursive", async () => {
    allFalse();
    await init({});

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it("should log success message", async () => {
    allFalse();
    await init({});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Initialized Pylon"),
    );
  });
});
