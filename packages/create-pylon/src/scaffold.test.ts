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
} from "./scaffold.js";
import type { Answers } from "./types.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const baseFeatures = (
  overrides: Partial<Answers["features"]> = {},
): Answers["features"] => ({
  http: true,
  socket: false,
  webhooks: false,
  audit: false,
  session: false,
  auth: false,
  rateLimit: false,
  ...overrides,
});

const baseAnswers = (overrides: Partial<Answers> = {}): Answers => ({
  projectName: "test-app",
  projectDir: "",
  features: baseFeatures(),
  proteusDriver: "none",
  irisDriver: "none",
  workers: [],
  ...overrides,
});

const FIXED_KEK = "kryptos:test-fixed-kek-placeholder";

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

const dumpTree = (root: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        walk(full, rel);
      } else {
        result[rel] = readFileSync(full, "utf-8");
      }
    }
  };
  walk(root, "");
  return result;
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
        features: baseFeatures({ http: false }),
      });
      copyTemplates(answers);
      expect(dumpTree(projectDir)).toMatchSnapshot();
    });

    test("base + http overlay", () => {
      const answers = baseAnswers({ projectDir });
      copyTemplates(answers);
      expect(dumpTree(projectDir)).toMatchSnapshot();
    });

    test("base + http + socket + workers + webhooks", () => {
      const answers = baseAnswers({
        projectDir,
        features: baseFeatures({ socket: true, webhooks: true, audit: true }),
        workers: ["expiry-cleanup"],
      });
      copyTemplates(answers);
      expect(dumpTree(projectDir)).toMatchSnapshot();
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
      writeEnvFile(answers, FIXED_KEK);
      expect(readFileSync(join(projectDir, ".env"), "utf-8")).toMatchSnapshot();
    });

    test("postgres + kafka", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({
        projectDir,
        proteusDriver: "postgres",
        irisDriver: "kafka",
      });
      writeEnvFile(answers, FIXED_KEK);
      expect(readFileSync(join(projectDir, ".env"), "utf-8")).toMatchSnapshot();
    });

    test("generates a real kryptos env string when no kek is supplied", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writeEnvFile(answers);
      const env = readFileSync(join(projectDir, ".env"), "utf-8");
      expect(env).toMatch(/^PYLON_KEK=kryptos:[A-Za-z0-9_-]+$/m);
    });
  });

  describe("buildEnvLines", () => {
    test.each([
      ["none-none", baseAnswers()],
      ["mongo-nats", baseAnswers({ proteusDriver: "mongo", irisDriver: "nats" })],
      ["sqlite-redis", baseAnswers({ proteusDriver: "sqlite", irisDriver: "redis" })],
      ["mysql-rabbit", baseAnswers({ proteusDriver: "mysql", irisDriver: "rabbit" })],
      ["none-none + auth", baseAnswers({ features: baseFeatures({ auth: true }) })],
      [
        "postgres-rabbit + auth",
        baseAnswers({
          proteusDriver: "postgres",
          irisDriver: "rabbit",
          features: baseFeatures({ auth: true }),
        }),
      ],
    ])("snapshot: %s", (_name, answers) => {
      expect(buildEnvLines(answers, FIXED_KEK)).toMatchSnapshot();
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

  describe("writeConfigFile", () => {
    test.each<[string, Partial<Answers>]>([
      ["no drivers", {}],
      ["memory proteus only", { proteusDriver: "memory" }],
      ["postgres only", { proteusDriver: "postgres" }],
      ["sqlite only", { proteusDriver: "sqlite" }],
      ["kafka only", { irisDriver: "kafka" }],
      ["nats only", { irisDriver: "nats" }],
      ["rabbit only", { irisDriver: "rabbit" }],
      ["redis only", { irisDriver: "redis" }],
      ["postgres + kafka", { proteusDriver: "postgres", irisDriver: "kafka" }],
      ["mongo + nats", { proteusDriver: "mongo", irisDriver: "nats" }],
      ["auth only", { features: baseFeatures({ auth: true }) }],
      [
        "postgres + auth",
        { proteusDriver: "postgres", features: baseFeatures({ auth: true }) },
      ],
    ])("snapshot: %s", (_name, overrides) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, ...overrides });
      writeConfigFile(answers);
      expect(
        readFileSync(join(projectDir, "src/pylon/config.ts"), "utf-8"),
      ).toMatchSnapshot();
    });
  });

  describe("writePylonFile", () => {
    test.each<[string, Partial<Answers>]>([
      ["http only, no drivers, no workers", {}],
      [
        "socket only, no drivers",
        { features: baseFeatures({ http: false, socket: true }) },
      ],
      ["http + socket, no drivers", { features: baseFeatures({ socket: true }) }],
      [
        "http + postgres",
        {
          proteusDriver: "postgres",
        },
      ],
      [
        "http + rabbit",
        {
          irisDriver: "rabbit",
        },
      ],
      ["http + postgres + rabbit", { proteusDriver: "postgres", irisDriver: "rabbit" }],
      [
        "http + postgres + rabbit + webhooks + audit",
        {
          proteusDriver: "postgres" as const,
          irisDriver: "rabbit" as const,
          features: baseFeatures({ webhooks: true, audit: true }),
        },
      ],
      [
        "all features + all proteus workers",
        {
          proteusDriver: "postgres" as const,
          irisDriver: "kafka" as const,
          features: baseFeatures({ socket: true, webhooks: true, audit: true }),
          workers: ["amphora-entity-sync", "expiry-cleanup", "kryptos-rotation"] as Array<
            Answers["workers"][number]
          >,
        },
      ],
      ["session only, no proteus", { features: baseFeatures({ session: true }) }],
      [
        "session with proteus (persistent)",
        {
          proteusDriver: "postgres" as const,
          features: baseFeatures({ session: true }),
        },
      ],
      [
        "auth only (session auto-forced)",
        { features: baseFeatures({ session: true, auth: true }) },
      ],
      [
        "rate limit with proteus",
        {
          proteusDriver: "postgres" as const,
          features: baseFeatures({ rateLimit: true }),
        },
      ],
      [
        "session + auth + rate limit + postgres",
        {
          proteusDriver: "postgres" as const,
          features: baseFeatures({ session: true, auth: true, rateLimit: true }),
        },
      ],
    ])("snapshot: %s", (_name, overrides) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, ...overrides });
      writePylonFile(answers);
      expect(
        readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8"),
      ).toMatchSnapshot();
    });
  });

  describe("writeDockerCompose", () => {
    test.each<[string, Partial<Answers>]>([
      ["postgres", { proteusDriver: "postgres" }],
      ["mysql", { proteusDriver: "mysql" }],
      ["mongo", { proteusDriver: "mongo" }],
      ["proteus redis", { proteusDriver: "redis" }],
      ["rabbit", { irisDriver: "rabbit" }],
      ["kafka + zookeeper", { irisDriver: "kafka" }],
      ["nats", { irisDriver: "nats" }],
      ["iris redis", { irisDriver: "redis" }],
      ["postgres + rabbit", { proteusDriver: "postgres", irisDriver: "rabbit" }],
      ["redis dedup", { proteusDriver: "redis", irisDriver: "redis" }],
      ["mongo + kafka", { proteusDriver: "mongo", irisDriver: "kafka" }],
    ])("snapshot: %s", (_name, overrides) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, ...overrides });
      writeDockerCompose(answers);
      expect(
        readFileSync(join(projectDir, "docker-compose.yml"), "utf-8"),
      ).toMatchSnapshot();
    });

    test("skipped when no driver needs it", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, proteusDriver: "sqlite" });
      writeDockerCompose(answers);
      expect(existsSync(join(projectDir, "docker-compose.yml"))).toBe(false);
    });

    test("skipped when only memory selected", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, proteusDriver: "memory" });
      writeDockerCompose(answers);
      expect(existsSync(join(projectDir, "docker-compose.yml"))).toBe(false);
    });
  });

  describe("writeWorkerFiles", () => {
    test.each<[string, Answers["workers"]]>([
      ["amphora-entity-sync only", ["amphora-entity-sync"]],
      ["expiry-cleanup only", ["expiry-cleanup"]],
      ["kryptos-rotation only", ["kryptos-rotation"]],
      ["all three", ["amphora-entity-sync", "expiry-cleanup", "kryptos-rotation"]],
    ])("snapshot: %s", (_name, workers) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({
        projectDir,
        proteusDriver: "postgres",
        workers,
      });
      writeWorkerFiles(answers);
      for (const key of workers) {
        expect(
          readFileSync(join(projectDir, "src/workers", `${key}.ts`), "utf-8"),
        ).toMatchSnapshot(`${key} content`);
      }
    });

    test("skipped when no workers selected", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writeWorkerFiles(answers);
      expect(existsSync(join(projectDir, "src/workers"))).toBe(false);
    });
  });

  describe("writeIrisSamples", () => {
    test.each<[string, Answers["irisDriver"]]>([
      ["rabbit", "rabbit"],
      ["kafka", "kafka"],
      ["nats", "nats"],
      ["redis", "redis"],
    ])("snapshot: %s publisher + subscriber", (_name, irisDriver) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, irisDriver });
      writeIrisSamples(answers);
      expect(
        readFileSync(
          join(projectDir, "src/iris/publishers/sample-publisher.ts"),
          "utf-8",
        ),
      ).toMatchSnapshot("publisher");
      expect(
        readFileSync(
          join(projectDir, "src/iris/subscribers/sample-subscriber.ts"),
          "utf-8",
        ),
      ).toMatchSnapshot("subscriber");
    });

    test("skipped when iris is none", () => {
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
        features: baseFeatures({ socket: true, webhooks: true, audit: true }),
        workers: ["expiry-cleanup"],
      });
      await scaffold(answers, FIXED_KEK);
      expect(listTree(projectDir)).toMatchSnapshot();
    });

    test("session-only combo", async () => {
      const answers = baseAnswers({
        projectDir,
        features: baseFeatures({ session: true }),
      });
      await scaffold(answers, FIXED_KEK);
      expect(listTree(projectDir)).toMatchSnapshot();
    });

    test("auth-only combo (auto-forces session)", async () => {
      const answers = baseAnswers({
        projectDir,
        features: baseFeatures({ session: true, auth: true }),
      });
      await scaffold(answers, FIXED_KEK);
      expect(
        readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8"),
      ).toMatchSnapshot("pylon.ts");
      expect(
        readFileSync(join(projectDir, "src/pylon/config.ts"), "utf-8"),
      ).toMatchSnapshot("config.ts");
      expect(readFileSync(join(projectDir, ".env"), "utf-8")).toMatchSnapshot(".env");
    });

    test("rateLimit-only combo (with postgres)", async () => {
      const answers = baseAnswers({
        projectDir,
        proteusDriver: "postgres",
        features: baseFeatures({ rateLimit: true }),
      });
      await scaffold(answers, FIXED_KEK);
      expect(
        readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8"),
      ).toMatchSnapshot("pylon.ts");
    });

    test("all-on: postgres + rabbit + sessions + auth + rateLimit + workers", async () => {
      const answers = baseAnswers({
        projectDir,
        proteusDriver: "postgres",
        irisDriver: "rabbit",
        features: baseFeatures({
          socket: true,
          webhooks: true,
          audit: true,
          session: true,
          auth: true,
          rateLimit: true,
        }),
        workers: ["amphora-entity-sync", "expiry-cleanup", "kryptos-rotation"],
      });
      await scaffold(answers, FIXED_KEK);
      expect(listTree(projectDir)).toMatchSnapshot("tree");
      expect(
        readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8"),
      ).toMatchSnapshot("pylon.ts");
      expect(
        readFileSync(join(projectDir, "src/pylon/config.ts"), "utf-8"),
      ).toMatchSnapshot("config.ts");
      expect(readFileSync(join(projectDir, ".env"), "utf-8")).toMatchSnapshot(".env");
    });
  });
});
