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
});
