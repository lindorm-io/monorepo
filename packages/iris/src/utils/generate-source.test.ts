import { generateSource } from "./generate-source";
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
});
