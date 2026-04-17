import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildDependencyList,
  buildEnvLines,
  copyTemplates,
  scaffold,
  writeConfigFile,
  writeDockerCompose,
  writeEnvFile,
  writeIrisSamples,
  writePackageJson,
  writePylonFile,
  writeWorkerFiles,
} from "./scaffold";
import type { Answers } from "./types";

const baseAnswers = (overrides: Partial<Answers> = {}): Answers => ({
  projectName: "test-app",
  projectDir: "",
  features: { http: true, socket: false, webhooks: false, audit: false },
  proteusDriver: "none",
  irisDriver: "none",
  workers: [],
  ...overrides,
});

const listTree = (root: string): Array<string> => {
  const results: Array<string> = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        walk(full, rel);
      } else {
        results.push(rel);
      }
    }
  };
  walk(root, "");
  return results;
};

describe("scaffold", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = join(tmpdir(), `create-pylon-scaffold-${Date.now()}-${Math.random()}`);
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  describe("copyTemplates", () => {
    test("base only — http false, socket false", () => {
      const answers = baseAnswers({
        projectDir,
        features: { http: false, socket: false, webhooks: false, audit: false },
      });
      copyTemplates(answers);
      expect(listTree(projectDir)).toMatchSnapshot();
    });

    test("base + http overlay", () => {
      const answers = baseAnswers({ projectDir });
      copyTemplates(answers);
      expect(listTree(projectDir)).toMatchSnapshot();
    });

    test("base + http + socket + workers + webhooks", () => {
      const answers = baseAnswers({
        projectDir,
        features: { http: true, socket: true, webhooks: true, audit: true },
        workers: ["amphora-refresh"],
      });
      copyTemplates(answers);
      expect(listTree(projectDir)).toMatchSnapshot();
    });

    test("renames _gitignore to .gitignore but leaves _middleware.ts alone", () => {
      const answers = baseAnswers({ projectDir });
      copyTemplates(answers);
      expect(existsSync(join(projectDir, ".gitignore"))).toBe(true);
      expect(existsSync(join(projectDir, "_gitignore"))).toBe(false);
      expect(existsSync(join(projectDir, "src/routes/_middleware.ts"))).toBe(true);
    });
  });

  describe("writePackageJson", () => {
    test("default answers produce minimal package.json", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writePackageJson(answers);
      expect(readFileSync(join(projectDir, "package.json"), "utf-8")).toMatchSnapshot();
    });

    test("adds docker scripts when driver needs compose", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, proteusDriver: "postgres" });
      writePackageJson(answers);
      expect(readFileSync(join(projectDir, "package.json"), "utf-8")).toMatchSnapshot();
    });
  });

  describe("writeEnvFile", () => {
    test("none drivers", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writeEnvFile(answers);
      expect(readFileSync(join(projectDir, ".env"), "utf-8")).toMatchSnapshot();
    });

    test("postgres + kafka", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({
        projectDir,
        proteusDriver: "postgres",
        irisDriver: "kafka",
      });
      writeEnvFile(answers);
      expect(readFileSync(join(projectDir, ".env"), "utf-8")).toMatchSnapshot();
    });
  });

  describe("buildEnvLines", () => {
    test.each([
      ["none-none", baseAnswers()],
      ["mongo-nats", baseAnswers({ proteusDriver: "mongo", irisDriver: "nats" })],
      ["sqlite-redis", baseAnswers({ proteusDriver: "sqlite", irisDriver: "redis" })],
      ["mysql-rabbit", baseAnswers({ proteusDriver: "mysql", irisDriver: "rabbit" })],
    ])("snapshot: %s", (_name, answers) => {
      expect(buildEnvLines(answers)).toMatchSnapshot();
    });
  });

  describe("buildDependencyList", () => {
    test.each([
      ["none-none", baseAnswers()],
      [
        "postgres-rabbit",
        baseAnswers({ proteusDriver: "postgres", irisDriver: "rabbit" }),
      ],
      ["sqlite-kafka", baseAnswers({ proteusDriver: "sqlite", irisDriver: "kafka" })],
      ["redis-redis", baseAnswers({ proteusDriver: "redis", irisDriver: "redis" })],
      ["memory-nats", baseAnswers({ proteusDriver: "memory", irisDriver: "nats" })],
    ])("snapshot: %s", (_name, answers) => {
      expect(buildDependencyList(answers)).toMatchSnapshot();
    });
  });

  describe("stubs", () => {
    test("writeConfigFile stub writes placeholder", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writeConfigFile(answers);
      expect(
        readFileSync(join(projectDir, "src/pylon/config.ts"), "utf-8"),
      ).toMatchSnapshot();
    });

    test("writePylonFile stub writes placeholder", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writePylonFile(answers);
      expect(
        readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8"),
      ).toMatchSnapshot();
    });

    test("writeDockerCompose writes stub when driver needs it", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, proteusDriver: "postgres" });
      writeDockerCompose(answers);
      expect(
        readFileSync(join(projectDir, "docker-compose.yml"), "utf-8"),
      ).toMatchSnapshot();
    });

    test("writeDockerCompose is skipped when no driver needs it", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, proteusDriver: "sqlite" });
      writeDockerCompose(answers);
      expect(existsSync(join(projectDir, "docker-compose.yml"))).toBe(false);
    });

    test("writeWorkerFiles writes one file per selected worker", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({
        projectDir,
        proteusDriver: "postgres",
        workers: ["amphora-refresh", "expiry-cleanup"],
      });
      writeWorkerFiles(answers);
      expect(
        readFileSync(join(projectDir, "src/workers/amphora-refresh.ts"), "utf-8"),
      ).toMatchSnapshot();
      expect(
        readFileSync(join(projectDir, "src/workers/expiry-cleanup.ts"), "utf-8"),
      ).toMatchSnapshot();
    });

    test("writeIrisSamples writes pub/sub when iris selected", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, irisDriver: "rabbit" });
      writeIrisSamples(answers);
      expect(
        readFileSync(
          join(projectDir, "src/iris/publishers/sample-publisher.ts"),
          "utf-8",
        ),
      ).toMatchSnapshot();
      expect(
        readFileSync(
          join(projectDir, "src/iris/subscribers/sample-subscriber.ts"),
          "utf-8",
        ),
      ).toMatchSnapshot();
    });

    test("writeIrisSamples is skipped when iris is none", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writeIrisSamples(answers);
      expect(existsSync(join(projectDir, "src/iris"))).toBe(false);
    });
  });

  describe("scaffold orchestration", () => {
    test("runs all write functions in sequence", async () => {
      const answers = baseAnswers({
        projectDir,
        proteusDriver: "postgres",
        irisDriver: "rabbit",
        features: { http: true, socket: true, webhooks: true, audit: true },
        workers: ["amphora-refresh", "expiry-cleanup"],
      });
      await scaffold(answers);
      expect(listTree(projectDir)).toMatchSnapshot();
    });
  });
});
