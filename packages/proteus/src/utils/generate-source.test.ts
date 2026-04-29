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
});
