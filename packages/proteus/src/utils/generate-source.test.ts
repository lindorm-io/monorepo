import { generateSource } from "./generate-source.js";
import { describe, expect, it } from "vitest";

describe("generateSource", () => {
  it("emits TODO comment for postgres when loggerImport is omitted", () => {
    expect(generateSource({ driver: "postgres" })).toMatchSnapshot();
  });

  it("emits TODO comment for postgres when loggerImport is null", () => {
    expect(generateSource({ driver: "postgres", loggerImport: null })).toMatchSnapshot();
  });

  it("emits logger import when loggerImport is provided", () => {
    expect(
      generateSource({ driver: "postgres", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("emits logger import for mysql driver", () => {
    expect(
      generateSource({ driver: "mysql", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("emits logger import for sqlite driver", () => {
    expect(
      generateSource({ driver: "sqlite", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("emits logger import for redis driver", () => {
    expect(
      generateSource({ driver: "redis", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("emits logger import for mongo driver", () => {
    expect(
      generateSource({ driver: "mongo", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("emits logger import for memory driver", () => {
    expect(
      generateSource({ driver: "memory", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("omits migrations for non-sql drivers when loggerImport is omitted", () => {
    expect(generateSource({ driver: "redis" })).toMatchSnapshot();
  });

  it("reads url from configImport when provided (postgres)", () => {
    expect(
      generateSource({
        driver: "postgres",
        loggerImport: "../../logger/index.js",
        configImport: "../../pylon/config.js",
      }),
    ).toMatchSnapshot();
  });

  it("reads filename from configImport for sqlite", () => {
    expect(
      generateSource({
        driver: "sqlite",
        loggerImport: "../../logger/index.js",
        configImport: "../../pylon/config.js",
      }),
    ).toMatchSnapshot();
  });

  it("attaches a RedisCacheAdapter to a postgres DB source when cache=redis", () => {
    expect(
      generateSource({
        driver: "postgres",
        loggerImport: "../../logger/index.js",
        configImport: "../../pylon/config.js",
        cache: "redis",
      }),
    ).toMatchSnapshot();
  });

  it("uses default keyPrefix when cacheKeyPrefix is omitted", () => {
    expect(
      generateSource({
        driver: "mongo",
        loggerImport: "../../logger/index.js",
        configImport: "../../pylon/config.js",
        cache: "redis",
      }),
    ).toMatchSnapshot();
  });

  it("honours custom cacheKeyPrefix", () => {
    expect(
      generateSource({
        driver: "mysql",
        loggerImport: "../../logger/index.js",
        configImport: "../../pylon/config.js",
        cache: "redis",
        cacheKeyPrefix: "custom:ns:",
      }),
    ).toMatchSnapshot();
  });

  it("falls back to hardcoded redis connection when configImport is absent", () => {
    expect(
      generateSource({
        driver: "postgres",
        loggerImport: "../logger",
        cache: "redis",
      }),
    ).toMatchSnapshot();
  });

  it("attaches a MemoryCacheAdapter when cache=memory", () => {
    expect(
      generateSource({
        driver: "postgres",
        loggerImport: "../../logger/index.js",
        configImport: "../../pylon/config.js",
        cache: "memory",
      }),
    ).toMatchSnapshot();
  });

  it("ignores cache option for non-DB drivers (redis primary)", () => {
    expect(
      generateSource({
        driver: "redis",
        loggerImport: "../../logger/index.js",
        configImport: "../../pylon/config.js",
        cache: "memory",
      }),
    ).toMatchSnapshot();
  });

  it("ignores cache option for non-DB drivers (sqlite primary)", () => {
    expect(
      generateSource({
        driver: "sqlite",
        loggerImport: "../../logger/index.js",
        configImport: "../../pylon/config.js",
        cache: "redis",
      }),
    ).toMatchSnapshot();
  });

  it("emits amphora import and option when amphoraImport is provided", () => {
    const out = generateSource({
      driver: "postgres",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
    });
    expect(out).toContain(`import { amphora } from "../../pylon/amphora.js";`);
    expect(out).toContain(`  amphora: amphora,`);
    expect(out).toMatchSnapshot();
  });

  it("omits amphora import and option when amphoraImport is not provided", () => {
    const out = generateSource({
      driver: "postgres",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
    });
    expect(out).not.toContain("amphora");
  });

  it("emits naming option when provided (snake)", () => {
    const out = generateSource({
      driver: "postgres",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      naming: "snake",
    });
    expect(out).toContain(`  naming: "snake",`);
    expect(out).toMatchSnapshot();
  });

  it("emits synchronize: config.<driver>.synchronize when synchronizeFromConfig is true", () => {
    const out = generateSource({
      driver: "postgres",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      synchronizeFromConfig: true,
    });
    expect(out).toContain(`  synchronize: config.postgres.synchronize,`);
    expect(out).toMatchSnapshot();
  });

  it("emits runMigrations: config.<driver>.migrations when runMigrationsFromConfig is true", () => {
    const out = generateSource({
      driver: "postgres",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      runMigrationsFromConfig: true,
    });
    expect(out).toContain(`  runMigrations: config.postgres.migrations,`);
    expect(out).toMatchSnapshot();
  });

  it("omits synchronize line when synchronizeFromConfig is true but configImport is missing", () => {
    const out = generateSource({
      driver: "postgres",
      loggerImport: "../logger",
      synchronizeFromConfig: true,
    });
    expect(out).not.toContain("synchronize:");
  });

  it("omits runMigrations line when runMigrationsFromConfig is true but configImport is missing", () => {
    const out = generateSource({
      driver: "postgres",
      loggerImport: "../logger",
      runMigrationsFromConfig: true,
    });
    expect(out).not.toContain("runMigrations:");
  });

  it("ignores synchronize/runMigrations flags for redis driver", () => {
    const out = generateSource({
      driver: "redis",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
    expect(out).not.toContain("synchronize:");
    expect(out).not.toContain("runMigrations:");
  });

  it("ignores synchronize/runMigrations flags for memory driver", () => {
    const out = generateSource({
      driver: "memory",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
    expect(out).not.toContain("synchronize:");
    expect(out).not.toContain("runMigrations:");
  });

  it("emits all three new options together for a postgres scaffold-like call", () => {
    const out = generateSource({
      driver: "postgres",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
    expect(out).toMatchSnapshot();
  });

  it("emits synchronize/runMigrations for mongo (no migrations path array)", () => {
    const out = generateSource({
      driver: "mongo",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
    expect(out).toContain(`  synchronize: config.mongo.synchronize,`);
    expect(out).toContain(`  runMigrations: config.mongo.migrations,`);
    expect(out).toMatchSnapshot();
  });

  it("emits synchronize/runMigrations for sqlite", () => {
    const out = generateSource({
      driver: "sqlite",
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
    expect(out).toContain(`  synchronize: config.sqlite.synchronize,`);
    expect(out).toContain(`  runMigrations: config.sqlite.migrations,`);
    expect(out).toMatchSnapshot();
  });
});
