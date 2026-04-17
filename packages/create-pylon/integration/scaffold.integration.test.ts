import spawn from "cross-spawn";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  BASE_DEV_DEPENDENCIES,
  BASE_RUNTIME_DEPENDENCIES,
  IRIS_DRIVER_DEV_PACKAGES,
  PROTEUS_DRIVER_DEV_PACKAGES,
  buildDependencyList,
  buildDevDependencyList,
  runIrisGenerateMessage,
  runIrisInit,
  runProteusGenerateEntity,
  runProteusInit,
  scaffold,
} from "../src";
import type { Answers } from "../src";

type RunResult = { code: number; stdout: string; stderr: string };

const run = (command: string, args: Array<string>, cwd: string): Promise<RunResult> =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise({ code: code ?? -1, stdout, stderr });
    });
  });

const assertStepOk = (
  label: string,
  result: RunResult,
  extraCheck?: (r: RunResult) => string | null,
): void => {
  const extraFailure = extraCheck?.(result) ?? null;
  if (result.code === 0 && !extraFailure) return;

  const combined = [
    extraFailure ? `check-failure: ${extraFailure}` : null,
    result.stdout ? `--- stdout ---\n${result.stdout}` : null,
    result.stderr ? `--- stderr ---\n${result.stderr}` : null,
  ]
    .filter((s): s is string => s !== null)
    .join("\n");

  throw new Error(`${label} failed (exit ${result.code})\n${combined}`);
};

const resolveRuntimeDependencies = (answers: Answers): Array<string> => [
  ...BASE_RUNTIME_DEPENDENCIES,
  ...buildDependencyList(answers),
];

const resolveDevDependencies = (answers: Answers): Array<string> => [
  ...BASE_DEV_DEPENDENCIES,
  ...buildDevDependencyList(answers),
  ...PROTEUS_DRIVER_DEV_PACKAGES[answers.proteusDriver],
  ...IRIS_DRIVER_DEV_PACKAGES[answers.irisDriver],
];

describe("create-pylon scaffold integration", () => {
  let tempRoot: string;
  let answers: Answers;

  beforeAll(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "create-pylon-integration-"));
    answers = {
      projectName: "test-app",
      projectDir: join(tempRoot, "test-app"),
      features: { http: true, socket: true, webhooks: true, audit: true },
      proteusDriver: "postgres",
      irisDriver: "redis",
      workers: [
        "amphora-refresh",
        "amphora-entity-sync",
        "expiry-cleanup",
        "kryptos-rotation",
      ],
    };
  });

  afterAll(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("scaffolds a representative project that installs, runs drivers, and typechecks", async () => {
    // Step 1 — scaffold
    await scaffold(answers);

    const sanityFiles = [
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
      ".env",
      ".gitignore",
      "docker-compose.yml",
      "src/index.ts",
      "src/pylon/pylon.ts",
      "src/pylon/config.ts",
      "src/pylon/amphora.ts",
      "src/logger/index.ts",
      "src/workers/amphora-refresh.ts",
      "src/workers/amphora-entity-sync.ts",
      "src/workers/expiry-cleanup.ts",
      "src/workers/kryptos-rotation.ts",
      "src/iris/publishers/sample-publisher.ts",
      "src/iris/subscribers/sample-subscriber.ts",
    ];
    for (const rel of sanityFiles) {
      if (!existsSync(join(answers.projectDir, rel))) {
        throw new Error(`scaffold: expected file missing: ${rel}`);
      }
    }

    // Step 2 — install runtime deps
    const runtimeDeps = resolveRuntimeDependencies(answers);
    const runtimeResult = await run(
      "npm",
      ["install", "--save", "--legacy-peer-deps", ...runtimeDeps],
      answers.projectDir,
    );
    assertStepOk("npm install (runtime deps)", runtimeResult);

    // Step 3 — install dev deps
    const devDeps = resolveDevDependencies(answers);
    const devResult = await run(
      "npm",
      ["install", "--save-dev", "--legacy-peer-deps", ...devDeps],
      answers.projectDir,
    );
    assertStepOk("npm install (dev deps)", devResult);

    const binDir = join(answers.projectDir, "node_modules/.bin");
    for (const bin of ["tsc"]) {
      if (!existsSync(join(binDir, bin))) {
        throw new Error(
          `post-install: expected binary missing: node_modules/.bin/${bin}`,
        );
      }
    }

    // Step 4 — proteus init + generate entity via programmatic API
    await runProteusInit(answers.projectDir, answers.proteusDriver);
    if (!existsSync(join(answers.projectDir, "src/proteus/source.ts"))) {
      throw new Error("proteus init: src/proteus/source.ts not created");
    }
    await runProteusGenerateEntity(answers.projectDir, "SampleEntity");
    if (!existsSync(join(answers.projectDir, "src/proteus/entities/SampleEntity.ts"))) {
      throw new Error(
        "proteus generate entity: src/proteus/entities/SampleEntity.ts not created",
      );
    }

    // Step 5 — iris init + generate message via programmatic API
    await runIrisInit(answers.projectDir, answers.irisDriver);
    if (!existsSync(join(answers.projectDir, "src/iris/source.ts"))) {
      throw new Error("iris init: src/iris/source.ts not created");
    }
    await runIrisGenerateMessage(answers.projectDir, "SampleMessage");
    if (!existsSync(join(answers.projectDir, "src/iris/messages/SampleMessage.ts"))) {
      throw new Error(
        "iris generate message: src/iris/messages/SampleMessage.ts not created",
      );
    }

    // Step 6 — tsc --noEmit
    const tscResult = await run(join(binDir, "tsc"), ["--noEmit"], answers.projectDir);
    assertStepOk("tsc --noEmit", tscResult, (r) =>
      /error TS\d+/.test(r.stdout + r.stderr) ? "TypeScript errors reported" : null,
    );

    expect(tscResult.code).toBe(0);
  });
});
