import { generateSource } from "./generate-source.js";
import { describe, expect, it } from "vitest";

describe("generateSource", () => {
  it("emits TODO comment for rabbit when loggerImport is omitted", () => {
    expect(generateSource({ driver: "rabbit" })).toMatchSnapshot();
  });

  it("emits TODO comment for rabbit when loggerImport is null", () => {
    expect(generateSource({ driver: "rabbit", loggerImport: null })).toMatchSnapshot();
  });

  it("emits logger import when loggerImport is provided", () => {
    expect(
      generateSource({ driver: "rabbit", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("emits logger import for kafka driver", () => {
    expect(
      generateSource({ driver: "kafka", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("emits logger import for nats driver", () => {
    expect(
      generateSource({ driver: "nats", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("emits logger import for redis driver", () => {
    expect(
      generateSource({ driver: "redis", loggerImport: "../logger" }),
    ).toMatchSnapshot();
  });

  it("reads url from configImport for rabbit", () => {
    expect(
      generateSource({
        driver: "rabbit",
        loggerImport: "../logger/index.js",
        configImport: "../pylon/config.js",
      }),
    ).toMatchSnapshot();
  });

  it("reads brokers from configImport for kafka", () => {
    expect(
      generateSource({
        driver: "kafka",
        loggerImport: "../logger/index.js",
        configImport: "../pylon/config.js",
      }),
    ).toMatchSnapshot();
  });

  it("reads servers from configImport for nats", () => {
    expect(
      generateSource({
        driver: "nats",
        loggerImport: "../logger/index.js",
        configImport: "../pylon/config.js",
      }),
    ).toMatchSnapshot();
  });

  it("reads url from configImport for redis", () => {
    expect(
      generateSource({
        driver: "redis",
        loggerImport: "../logger/index.js",
        configImport: "../pylon/config.js",
      }),
    ).toMatchSnapshot();
  });
});
