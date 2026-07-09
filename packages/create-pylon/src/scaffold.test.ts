import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import prettier from "prettier";
import { buildVitestConfig } from "./build-vitest-config.js";
import {
  buildDependencyList,
  buildDevDependencyList,
  buildEnvExampleLines,
  buildEnvLines,
  copyTemplates,
  scaffold,
  writeVitestConfig,
  writeConfigDevelopmentYaml,
  writeConfigFile,
  writeConfigYaml,
  writeDockerCompose,
  writeEnvExampleFile,
  writeEnvFile,
  writeIrisSamples,
  writeLindormConfigFile,
  writePackageJson,
  writePylonFile,
  writeTestCtxFile,
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
  issuer: "http://localhost:3000",
  features: baseFeatures(),
  db: "none",
  kv: "none",
  bus: "none",
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

    test("wraps dev/test in composed when the driver needs compose", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, db: "postgres" });
      writePackageJson(answers);
      expect(readFileSync(join(projectDir, "package.json"), "utf-8")).toMatchSnapshot();
    });

    test("dev keeps volumes; test isolates + wipes them, when compose is needed", () => {
      mkdirSync(projectDir, { recursive: true });
      writePackageJson(
        baseAnswers({ projectDir, projectName: "@lindorm/tyr", db: "postgres" }),
      );
      const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
      // Dev persists data across restarts.
      expect(pkg.scripts.dev).toBe("composed -k tsx watch src/index.ts");
      // Test runs under an unscoped, isolated project (scope stripped) with the
      // default volume-wiping teardown — never touches the dev stack's volumes.
      expect(pkg.scripts.test).toBe("composed -p tyr-test vitest run --passWithNoTests");
      expect(pkg.scripts.test).not.toContain("@lindorm");
    });

    test("leaves dev/test unwrapped when no compose is needed", () => {
      mkdirSync(projectDir, { recursive: true });
      writePackageJson(baseAnswers({ projectDir }));
      const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
      expect(pkg.scripts.dev).toBe("tsx watch src/index.ts");
      expect(pkg.scripts.test).toBe("vitest run --passWithNoTests");
      expect(pkg.scripts).not.toHaveProperty("docker:up");
    });

    test("preserves an npm scope in the package name (F9)", () => {
      mkdirSync(projectDir, { recursive: true });
      writePackageJson(baseAnswers({ projectDir, projectName: "@acme/proxy" }));
      const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
      expect(pkg.name).toBe("@acme/proxy");
    });

    test("test script passes --passWithNoTests so a fresh scaffold doesn't exit 1 (F6)", () => {
      mkdirSync(projectDir, { recursive: true });
      writePackageJson(baseAnswers({ projectDir }));
      const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
      expect(pkg.scripts.test).toBe("vitest run --passWithNoTests");
    });
  });

  describe("writeLindormConfigFile", () => {
    test("generates a lindorm.config.ts that uses defineConfig from @lindorm/scaffold", () => {
      mkdirSync(projectDir, { recursive: true });
      writeLindormConfigFile(baseAnswers({ projectDir }));
      const content = readFileSync(join(projectDir, "lindorm.config.ts"), "utf-8");
      expect(content).toContain('import { defineConfig } from "@lindorm/scaffold"');
      expect(content).toContain("export default defineConfig({");
      expect(content).toMatchSnapshot();
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
        db: "postgres",
        bus: "kafka",
      });
      writeEnvFile(answers, FIXED_KEK);
      expect(readFileSync(join(projectDir, ".env"), "utf-8")).toMatchSnapshot();
    });

    test("generates a real kryptos env string when no kek is supplied", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writeEnvFile(answers);
      const env = readFileSync(join(projectDir, ".env"), "utf-8");
      expect(env).toMatch(/^PYLON__KEK=kryptos:[A-Za-z0-9_-]+$/m);
    });
  });

  describe("buildEnvLines", () => {
    // The slim .env only carries the per-developer secret(s). Driver URLs
    // moved to config/development.yml; everything else is in default.yml.
    test.each([
      ["minimal", baseAnswers()],
      [
        "with auth (adds AUTH__CLIENT_SECRET placeholder)",
        baseAnswers({ features: baseFeatures({ auth: true }) }),
      ],
      [
        "drivers don't add anything to .env",
        baseAnswers({
          db: "postgres",
          kv: "redis",
          bus: "kafka",
        }),
      ],
    ])("snapshot: %s", (_name, answers) => {
      expect(buildEnvLines(answers, FIXED_KEK)).toMatchSnapshot();
    });
  });

  describe("buildDependencyList", () => {
    test.each([
      ["none-none", baseAnswers()],
      ["postgres-rabbit", baseAnswers({ db: "postgres", bus: "rabbit" })],
      ["sqlite-kafka", baseAnswers({ db: "sqlite", bus: "kafka" })],
      ["redis-redis", baseAnswers({ kv: "redis", bus: "redis" })],
      ["memory-nats", baseAnswers({ db: "memory", bus: "nats" })],
      [
        "postgres+redis-rabbit",
        baseAnswers({ db: "postgres", kv: "redis", bus: "rabbit" }),
      ],
    ])("snapshot: %s", (_name, answers) => {
      expect(buildDependencyList(answers)).toMatchSnapshot();
    });

    test("includes @lindorm/proteus and its @lindorm/aes encryption peer when a driver is selected", () => {
      const deps = buildDependencyList(baseAnswers({ db: "postgres" }));
      expect(deps).toContain("@lindorm/proteus");
      expect(deps).toContain("@lindorm/aes");
      expect(deps).toContain("pg");
    });

    test("only the picked driver packages are added — never all six", () => {
      const deps = buildDependencyList(baseAnswers({ db: "postgres", kv: "redis" }));
      expect(deps).toContain("pg");
      expect(deps).toContain("ioredis");
      expect(deps).not.toContain("mysql2");
      expect(deps).not.toContain("mongodb");
      expect(deps).not.toContain("better-sqlite3");
    });

    test("omits proteus deps (incl. @lindorm/aes) when no driver is selected", () => {
      const deps = buildDependencyList(baseAnswers());
      expect(deps).not.toContain("@lindorm/proteus");
      expect(deps).not.toContain("@lindorm/aes");
    });
  });

  describe("buildVitestConfig / writeVitestConfig (F5)", () => {
    test("wires the swc decorator transform when a driver is selected", () => {
      const content = buildVitestConfig(baseAnswers({ db: "postgres" }));
      expect(content).toContain('import swc from "unplugin-swc"');
      expect(content).toContain("decorators: true");
      expect(content).toContain('decoratorVersion: "2022-03"');
      expect(content).toContain("oxc: false");
    });

    test("wires the swc decorator transform when only a kv driver is selected", () => {
      const content = buildVitestConfig(baseAnswers({ kv: "redis" }));
      expect(content).toContain('import swc from "unplugin-swc"');
    });

    test("emits a bare config (no swc) when no driver is selected", () => {
      const content = buildVitestConfig(baseAnswers());
      expect(content).not.toContain("unplugin-swc");
      expect(content).not.toContain("decorators");
      expect(content).toContain("vitest/config");
    });

    test("adds unplugin-swc + @swc/core dev deps only when a driver is selected", () => {
      expect(buildDevDependencyList(baseAnswers({ db: "sqlite" }))).toEqual([
        "unplugin-swc",
        "@swc/core",
      ]);
      expect(buildDevDependencyList(baseAnswers())).toEqual([]);
    });

    test("adds @lindorm/composed dev dep only when the stack needs docker-compose", () => {
      // sqlite is a file DB — no compose, so no composed.
      expect(buildDevDependencyList(baseAnswers({ db: "sqlite" }))).not.toContain(
        "@lindorm/composed",
      );
      // postgres needs compose — composed is added ahead of the swc transform deps.
      expect(buildDevDependencyList(baseAnswers({ db: "postgres" }))).toEqual([
        "@lindorm/composed",
        "unplugin-swc",
        "@swc/core",
      ]);
      // a bus alone (no db/kv) still needs compose, but no swc transform deps.
      expect(buildDevDependencyList(baseAnswers({ bus: "rabbit" }))).toEqual([
        "@lindorm/composed",
      ]);
    });

    test("writeVitestConfig writes vitest.config.mjs to the project root", () => {
      mkdirSync(projectDir, { recursive: true });
      writeVitestConfig(baseAnswers({ projectDir, db: "postgres" }));
      const content = readFileSync(join(projectDir, "vitest.config.mjs"), "utf-8");
      expect(content).toContain("unplugin-swc");
    });
  });

  describe("writeConfigFile", () => {
    test.each<[string, Partial<Answers>]>([
      ["no drivers", {}],
      ["memory db only", { db: "memory" }],
      ["postgres only", { db: "postgres" }],
      ["sqlite only", { db: "sqlite" }],
      ["redis kv only", { kv: "redis" }],
      ["postgres + redis", { db: "postgres", kv: "redis" }],
      ["kafka only", { bus: "kafka" }],
      ["nats only", { bus: "nats" }],
      ["rabbit only", { bus: "rabbit" }],
      ["redis iris only", { bus: "redis" }],
      ["postgres + kafka", { db: "postgres", bus: "kafka" }],
      ["mongo + nats", { db: "mongo", bus: "nats" }],
      ["auth only", { features: baseFeatures({ auth: true }) }],
      ["postgres + auth", { db: "postgres", features: baseFeatures({ auth: true }) }],
    ])("snapshot: %s", (_name, overrides) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, ...overrides });
      writeConfigFile(answers);
      expect(
        readFileSync(join(projectDir, "src/pylon/config.ts"), "utf-8"),
      ).toMatchSnapshot();
    });

    test("uses zod-4 .prefault({}) for the logger object default (not .default({}))", () => {
      mkdirSync(projectDir, { recursive: true });
      writeConfigFile(baseAnswers({ projectDir }));
      const content = readFileSync(join(projectDir, "src/pylon/config.ts"), "utf-8");
      // zod 4: object input-side defaults use .prefault(); .default({}) on an
      // object whose fields have their own defaults fails to type-check.
      expect(content).toContain(".prefault({})");
      expect(content).not.toContain(".default({})");
    });
  });

  describe("writeConfigYaml", () => {
    test.each<[string, Partial<Answers>]>([
      ["no drivers", {}],
      ["postgres only", { db: "postgres" }],
      ["sqlite only", { db: "sqlite" }],
      ["postgres + redis", { db: "postgres", kv: "redis" }],
      ["redis kv + redis iris (deduped)", { kv: "redis", bus: "redis" }],
      ["postgres + kafka", { db: "postgres", bus: "kafka" }],
      ["nats only", { bus: "nats" }],
      ["postgres + auth", { db: "postgres", features: baseFeatures({ auth: true }) }],
    ])("snapshot: %s", (_name, overrides) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, ...overrides });
      writeConfigYaml(answers);
      expect(
        readFileSync(join(projectDir, "config/default.yml"), "utf-8"),
      ).toMatchSnapshot();
    });
  });

  describe("writeConfigDevelopmentYaml", () => {
    test.each<[string, Partial<Answers>]>([
      ["no drivers", {}],
      ["postgres only", { db: "postgres" }],
      ["mysql only", { db: "mysql" }],
      ["postgres + redis", { db: "postgres", kv: "redis" }],
      ["postgres + kafka", { db: "postgres", bus: "kafka" }],
      ["mongo + rabbit", { db: "mongo", bus: "rabbit" }],
      ["sqlite + nats", { db: "sqlite", bus: "nats" }],
      ["redis kv + redis iris (deduped)", { kv: "redis", bus: "redis" }],
    ])("snapshot: %s", (_name, overrides) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, ...overrides });
      writeConfigDevelopmentYaml(answers);
      expect(
        readFileSync(join(projectDir, "config/development.yml"), "utf-8"),
      ).toMatchSnapshot();
    });
  });

  describe("buildEnvExampleLines", () => {
    test.each<[string, Partial<Answers>]>([
      ["no drivers", {}],
      ["postgres + kafka", { db: "postgres", bus: "kafka" }],
      ["mysql + rabbit", { db: "mysql", bus: "rabbit" }],
      ["postgres + redis", { db: "postgres", kv: "redis" }],
      ["postgres + auth", { db: "postgres", features: baseFeatures({ auth: true }) }],
    ])("snapshot: %s", (_name, overrides) => {
      const answers = baseAnswers({ ...overrides });
      expect(buildEnvExampleLines(answers)).toMatchSnapshot();
    });
  });

  describe("writeEnvExampleFile", () => {
    test("writes .env.example to project root", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({
        projectDir,
        db: "postgres",
        bus: "kafka",
      });
      writeEnvExampleFile(answers);
      expect(existsSync(join(projectDir, ".env.example"))).toBe(true);
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
      ["http + postgres", { db: "postgres" }],
      ["http + redis kv only", { kv: "redis" }],
      ["http + rabbit", { bus: "rabbit" }],
      ["http + postgres + rabbit", { db: "postgres", bus: "rabbit" }],
      [
        "http + postgres + rabbit + webhooks + audit",
        {
          db: "postgres",
          bus: "rabbit" as const,
          features: baseFeatures({ webhooks: true, audit: true }),
        },
      ],
      [
        "all features + all proteus workers",
        {
          db: "postgres",
          kv: "redis",
          bus: "kafka" as const,
          features: baseFeatures({ socket: true, webhooks: true, audit: true }),
          workers: ["amphora-entity-sync", "expiry-cleanup", "kryptos-rotation"] as Array<
            Answers["workers"][number]
          >,
        },
      ],
      ["session only, no proteus", { features: baseFeatures({ session: true }) }],
      [
        "session with db (persistent)",
        { db: "postgres", features: baseFeatures({ session: true }) },
      ],
      [
        "auth only (session auto-forced)",
        { features: baseFeatures({ session: true, auth: true }) },
      ],
      [
        "rate limit with postgres + redis",
        { db: "postgres", kv: "redis", features: baseFeatures({ rateLimit: true }) },
      ],
      [
        "rate limit with redis kv only",
        { kv: "redis", features: baseFeatures({ rateLimit: true }) },
      ],
      [
        "session + auth + rate limit + postgres + redis",
        {
          db: "postgres",
          kv: "redis",
          features: baseFeatures({ session: true, auth: true, rateLimit: true }),
        },
      ],
      ["db=none + kv=redis", { kv: "redis" }],
      ["db=memory + kv=memory", { db: "memory", kv: "memory" }],
      [
        "db=postgres + kv=redis + bus=rabbit (plain, no collision)",
        { db: "postgres", kv: "redis", bus: "rabbit" },
      ],
      [
        "db=postgres + kv=redis + bus=redis (redis collision → redisKv/redisBus)",
        { db: "postgres", kv: "redis", bus: "redis" },
      ],
      [
        "db=none + kv=redis + bus=redis (redis collision → redisDb/redisBus)",
        { kv: "redis", bus: "redis" },
      ],
      [
        "db=postgres + kv=redis + auth + rateLimit + all workers",
        {
          db: "postgres",
          kv: "redis",
          features: baseFeatures({ session: true, auth: true, rateLimit: true }),
          workers: ["amphora-entity-sync", "expiry-cleanup", "kryptos-rotation"] as Array<
            Answers["workers"][number]
          >,
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

  describe("writeTestCtxFile", () => {
    test.each<[string, Partial<Answers>]>([
      ["db only", { db: "postgres" }],
      ["kv only", { kv: "redis" }],
      ["db + kv", { db: "postgres", kv: "redis" }],
      ["memory db", { db: "memory" }],
    ])("snapshot: %s", (_name, overrides) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, ...overrides });
      writeTestCtxFile(answers);
      expect(
        readFileSync(join(projectDir, "src/__fixtures__/test-ctx.ts"), "utf-8"),
      ).toMatchSnapshot();
    });

    test("re-exports a thin ServerHttpContext factory over the mock ctx", () => {
      mkdirSync(projectDir, { recursive: true });
      writeTestCtxFile(baseAnswers({ projectDir, db: "postgres" }));
      const content = readFileSync(
        join(projectDir, "src/__fixtures__/test-ctx.ts"),
        "utf-8",
      );
      expect(content).toContain(`createTestPylonCtx`);
      expect(content).toContain(`type CreateTestPylonCtxOptions`);
      expect(content).toContain(`from "@lindorm/pylon/mocks/vitest";`);
      expect(content).toContain(
        `import type { ServerHttpContext } from "../types/context.js";`,
      );
      expect(content).toContain(`createTestPylonCtx(options) as ServerHttpContext;`);
      // No entity dir wiring — ctx.db / ctx.kv are stateful proteus mocks.
      expect(content).not.toContain(`ENTITY_DIRS`);
      expect(content).not.toContain(`join`);
      expect(content).not.toContain(`SampleEntity`);
    });

    test("skipped when no proteus store is selected", () => {
      mkdirSync(projectDir, { recursive: true });
      writeTestCtxFile(baseAnswers({ projectDir }));
      expect(existsSync(join(projectDir, "src/__fixtures__/test-ctx.ts"))).toBe(false);
    });
  });

  describe("writeDockerCompose", () => {
    test.each<[string, Partial<Answers>]>([
      ["postgres", { db: "postgres" }],
      ["mysql", { db: "mysql" }],
      ["mongo", { db: "mongo" }],
      ["redis kv", { kv: "redis" }],
      ["rabbit", { bus: "rabbit" }],
      ["kafka + zookeeper", { bus: "kafka" }],
      ["nats", { bus: "nats" }],
      ["iris redis", { bus: "redis" }],
      ["postgres + rabbit", { db: "postgres", bus: "rabbit" }],
      ["postgres + redis", { db: "postgres", kv: "redis" }],
      ["redis dedup", { kv: "redis", bus: "redis" }],
      ["mongo + kafka", { db: "mongo", bus: "kafka" }],
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
      const answers = baseAnswers({ projectDir, db: "sqlite" });
      writeDockerCompose(answers);
      expect(existsSync(join(projectDir, "docker-compose.yml"))).toBe(false);
    });

    test("skipped when only memory selected", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, db: "memory", kv: "memory" });
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
        db: "postgres",
        workers,
      });
      writeWorkerFiles(answers);
      for (const key of workers) {
        expect(
          readFileSync(join(projectDir, "src/workers", `${key}.ts`), "utf-8"),
        ).toMatchSnapshot(`${key} content`);
      }
    });

    test("workers import the flat primary source (db + kv)", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({
        projectDir,
        db: "postgres",
        kv: "redis",
        workers: ["amphora-entity-sync", "expiry-cleanup", "kryptos-rotation"],
      });
      writeWorkerFiles(answers);
      for (const key of answers.workers) {
        const content = readFileSync(
          join(projectDir, "src/workers", `${key}.ts`),
          "utf-8",
        );
        expect(content).toContain(`from "../proteus/source.js"`);
        expect(content).not.toContain(`from "../proteus/kv/source.js"`);
      }
    });

    test("workers import the flat primary source when kv is the sole driver", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({
        projectDir,
        kv: "redis",
        workers: ["kryptos-rotation"],
      });
      writeWorkerFiles(answers);
      const content = readFileSync(
        join(projectDir, "src/workers/kryptos-rotation.ts"),
        "utf-8",
      );
      expect(content).toContain(`from "../proteus/source.js"`);
    });

    test("skipped when no workers selected", () => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir });
      writeWorkerFiles(answers);
      expect(existsSync(join(projectDir, "src/workers"))).toBe(false);
    });
  });

  describe("writeIrisSamples", () => {
    test.each<[string, Answers["bus"]]>([
      ["rabbit", "rabbit"],
      ["kafka", "kafka"],
      ["nats", "nats"],
      ["redis", "redis"],
    ])("snapshot: %s publisher + subscriber", (_name, bus) => {
      mkdirSync(projectDir, { recursive: true });
      const answers = baseAnswers({ projectDir, bus });
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
        db: "postgres",
        bus: "rabbit",
        features: baseFeatures({ socket: true, webhooks: true, audit: true }),
        workers: ["expiry-cleanup"],
      });
      await scaffold(answers, FIXED_KEK);
      expect(listTree(projectDir)).toMatchSnapshot();
    });

    test("generated output is prettier-stable under default config (F8)", async () => {
      const answers = baseAnswers({
        projectDir,
        db: "postgres",
        kv: "redis",
        bus: "kafka",
        features: baseFeatures({ socket: true, webhooks: true, audit: true }),
        workers: ["expiry-cleanup"],
      });
      await scaffold(answers, FIXED_KEK);

      const unformatted: Array<string> = [];
      for (const rel of listTree(projectDir)) {
        const file = join(projectDir, rel);
        const info = await prettier.getFileInfo(file);
        if (info.ignored || !info.inferredParser) continue;
        const source = readFileSync(file, "utf-8");
        if (!(await prettier.check(source, { filepath: file }))) {
          unformatted.push(rel);
        }
      }
      expect(unformatted).toEqual([]);
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

    test("rateLimit-only combo (with postgres + redis)", async () => {
      const answers = baseAnswers({
        projectDir,
        db: "postgres",
        kv: "redis",
        features: baseFeatures({ rateLimit: true }),
      });
      await scaffold(answers, FIXED_KEK);
      expect(
        readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8"),
      ).toMatchSnapshot("pylon.ts");
    });

    test("all-on: postgres + redis + rabbit + sessions + auth + rateLimit + workers", async () => {
      const answers = baseAnswers({
        projectDir,
        db: "postgres",
        kv: "redis",
        bus: "rabbit",
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

    describe("two-role sources (db + kv)", () => {
      test("context.ts is the plain base — no ExtraSources / IProteusSession", async () => {
        const answers = baseAnswers({
          projectDir,
          db: "postgres",
          kv: "redis",
          features: baseFeatures({ socket: true }),
        });
        await scaffold(answers, FIXED_KEK);

        const context = readFileSync(join(projectDir, "src/types/context.ts"), "utf-8");
        expect(context).not.toContain("ExtraSources");
        expect(context).not.toContain("IProteusSession");
        expect(context).toMatchSnapshot("context.ts");
      });

      test("no attach-sources middleware file is ever written", async () => {
        const answers = baseAnswers({
          projectDir,
          db: "postgres",
          kv: "redis",
          features: baseFeatures({ socket: true }),
        });
        await scaffold(answers, FIXED_KEK);

        expect(existsSync(join(projectDir, "src/middleware/attach-sources.ts"))).toBe(
          false,
        );
      });

      test("db + kv writes a distinct kv/source.ts secondary", async () => {
        const answers = baseAnswers({
          projectDir,
          db: "postgres",
          kv: "redis",
        });
        await scaffold(answers, FIXED_KEK);

        expect(existsSync(join(projectDir, "src/proteus/source.ts"))).toBe(true);
        expect(existsSync(join(projectDir, "src/proteus/kv/source.ts"))).toBe(true);

        const pylon = readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8");
        expect(pylon).toContain(`import { postgres } from "../proteus/source.js";`);
        expect(pylon).toContain(`import { redis } from "../proteus/kv/source.js";`);
      });

      test("kv-only writes a single flat primary — no kv subdir", async () => {
        const answers = baseAnswers({ projectDir, kv: "redis" });
        await scaffold(answers, FIXED_KEK);

        expect(existsSync(join(projectDir, "src/proteus/source.ts"))).toBe(true);
        expect(existsSync(join(projectDir, "src/proteus/kv"))).toBe(false);

        const pylon = readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8");
        expect(pylon).toContain(`import { redis } from "../proteus/source.js";`);
        expect(pylon).not.toContain(`../proteus/kv/source.js`);
      });

      test("session binds to the kv secondary when both db and kv are selected", async () => {
        const answers = baseAnswers({
          projectDir,
          db: "postgres",
          kv: "redis",
          features: baseFeatures({ session: true, auth: true }),
        });
        await scaffold(answers, FIXED_KEK);

        const pylon = readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8");
        expect(pylon).toMatch(/session: \{[^}]*kv: redis/);
      });

      test("wires the kv secondary as the top-level kv option", async () => {
        const answers = baseAnswers({
          projectDir,
          db: "postgres",
          kv: "redis",
          features: baseFeatures({ session: true, rateLimit: true }),
        });
        await scaffold(answers, FIXED_KEK);

        const pylon = readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8");
        expect(pylon).toMatch(/^ {2}db: postgres,$/m);
        expect(pylon).toMatch(/^ {2}kv: redis,$/m);
      });

      test("session falls back to the flat proteus source when only db is selected", async () => {
        const answers = baseAnswers({
          projectDir,
          db: "postgres",
          features: baseFeatures({ session: true, auth: true }),
        });
        await scaffold(answers, FIXED_KEK);

        const pylon = readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8");
        expect(pylon).toMatch(/session: \{[^}]*kv: postgres/);
        expect(pylon).not.toContain(`../proteus/kv/source.js`);
      });

      test("session binds to the flat primary when only kv is selected", async () => {
        const answers = baseAnswers({
          projectDir,
          kv: "redis",
          features: baseFeatures({ session: true, auth: true }),
        });
        await scaffold(answers, FIXED_KEK);

        const pylon = readFileSync(join(projectDir, "src/pylon/pylon.ts"), "utf-8");
        expect(pylon).toMatch(/session: \{[^}]*kv: redis/);
        expect(pylon).not.toContain(`../proteus/kv/source.js`);
      });
    });
  });
});
